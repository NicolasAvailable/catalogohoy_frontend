# Plan: SEO Completo + Fix Previews de Links

## Problema

- `index.html` tiene `<title>Dashboard | CatalogoHoy</title>` estático y cero meta tags OG
- WhatsApp/Facebook/Twitter no ejecutan JS → siempre ven "Dashboard | CatalogoHoy" y el logo de la plataforma
- No hay `description`, ni `og:image`, ni `og:title`, ni `twitter:card`
- No hay `robots.txt`, ni `sitemap.xml`, ni structured data

## Estrategia: Dos capas

**Capa 1 — Vercel Serverless (para crawlers sociales):**
- Función API que genera HTML con meta tags OG dinámicos
- `vercel.json` con rewrites condicionales por User-Agent
- Los crawlers de WhatsApp/Facebook/Twitter reciben HTML con OG tags correctos

**Capa 2 — Angular Meta Service (para Google + navegador):**
- Servicio que actualiza meta tags dinámicamente en el cliente
- Google renderiza JS, así que ve los meta tags actualizados
- JSON-LD structured data para rich snippets

---

## Archivos a crear

### 1. `vercel.json` (raíz del monorepo)
```json
{
  "buildCommand": "npm run build:catalogohoy",
  "outputDirectory": "dist/apps/catalogohoy/browser",
  "rewrites": [
    {
      "source": "/(.*)",
      "has": [
        {
          "type": "header",
          "key": "user-agent",
          "value": "(?i).*(facebookexternalhit|Twitterbot|WhatsApp|LinkedInBot|Slackbot|TelegramBot|Pinterest|Discordbot).*"
        }
      ],
      "destination": "/api/og?path=$1"
    },
    { "source": "/(.*)", "destination": "/index.html" }
  ],
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    }
  ]
}
```

### 2. `api/og.ts` — Vercel Serverless Function
- Lee `Host` header → extrae slug del subdominio (`franeleria.catalogohoy.com` → `franeleria`)
- Lee `path` query param → determina si es catálogo home (`/`) o producto (`/product/:id`)
- Consulta Supabase REST API con fetch directo (sin SDK, para mantenerse liviano):
  - **Catálogo:** `tenants` + `tenant_ecommerce_config` → nombre, logo, description
  - **Producto:** `products` → name, description, photos[0], price
- Retorna HTML mínimo con:
  ```html
  <meta property="og:title" content="{nombre}" />
  <meta property="og:description" content="{descripción}" />
  <meta property="og:image" content="{logo o foto}" />
  <meta property="og:url" content="https://{slug}.catalogohoy.com/{path}" />
  <meta property="og:type" content="website" />
  <meta property="og:locale" content="es_ES" />
  <meta name="twitter:card" content="summary_large_image" />
  ```

### 3. `apps/catalogohoy/public/robots.txt`
```
User-agent: *
Allow: /
Disallow: /admin/

Sitemap: https://catalogohoy.com/sitemap.xml
```

---

## Archivos a modificar

### 4. `apps/catalogohoy/src/index.html`
- Cambiar `lang="en"` → `lang="es"`
- Cambiar `<title>` a `CatalogoHoy — Tu catálogo digital`
- Agregar meta tags base como fallback:
  - `<meta name="description" content="...">`
  - `<meta property="og:title" content="...">`
  - `<meta property="og:description" content="...">`
  - `<meta property="og:image" content="{logo plataforma}">`
  - `<meta property="og:type" content="website">`
  - `<meta property="og:locale" content="es_ES">`
  - `<meta name="twitter:card" content="summary_large_image">`

### 5. `CatalogInfo` interface — Agregar `description`
**Archivo:** `libs/catalogohoy/e-commerce/src/domain/ecommerce.service.ts`
- Agregar `description: string | null` a `CatalogInfo`

### 6. `EcommerceService.getCatalogInfo()` — Fetch description
**Archivo:** `libs/catalogohoy/e-commerce/src/infrastructure/ecommerce.service.ts`
- Agregar `description` al select de `tenant_ecommerce_config`
- Mapear al campo `description` en el return

### 7. `ECommerce` component — Meta tags del catálogo
**Archivo:** `libs/catalogohoy/e-commerce/src/presenter/e-commerce/e-commerce.ts`
- Inyectar `Meta` de `@angular/platform-browser`
- En el effect existente de título, agregar:
  - `og:title` = `{nombre} | Catálogo`
  - `og:description` = descripción del tenant
  - `og:image` = logo del tenant
  - `og:url` = URL actual
  - `og:type` = `website`
  - `twitter:card` = `summary_large_image`
  - Canonical URL

### 8. `ProductDetail` component — Meta tags del producto
**Archivo:** `libs/catalogohoy/e-commerce/src/presenter/views/product-detail/product-detail.ts`
- Inyectar `Meta` y `Title` de `@angular/platform-browser`
- Cuando `selectedProduct()` cambie:
  - `og:title` = `{producto} — {tienda}`
  - `og:description` = descripción del producto (truncada a 160 chars)
  - `og:image` = primera foto del producto
  - `og:type` = `product`
  - `product:price:amount` / `product:price:currency`
  - JSON-LD `Product` schema

### 9. `Catalog` view — JSON-LD structured data
**Archivo:** `libs/catalogohoy/e-commerce/src/presenter/views/catalog/catalog.ts`
- Agregar JSON-LD `Store` schema con nombre, logo, URL del tenant

---

## Resumen de cambios

| # | Archivo | Acción | Propósito |
|---|---------|--------|-----------|
| 1 | `vercel.json` | Crear | Rewrites para crawlers + SPA fallback |
| 2 | `api/og.ts` | Crear | Meta tags OG dinámicos server-side |
| 3 | `public/robots.txt` | Crear | Indexación SEO |
| 4 | `index.html` | Modificar | Meta tags base fallback + lang="es" |
| 5 | `ecommerce.service.ts` (domain) | Modificar | Agregar description a CatalogInfo |
| 6 | `ecommerce.service.ts` (infra) | Modificar | Fetch description de Supabase |
| 7 | `e-commerce.ts` | Modificar | Meta tags dinámicos catálogo + JSON-LD |
| 8 | `product-detail.ts` | Modificar | Meta tags dinámicos producto + JSON-LD |
| 9 | `catalog.ts` | Modificar | JSON-LD Store schema |

## Notas

- La función `api/og.ts` usa `fetch` directo contra la REST API de Supabase (no el SDK) para ser liviana
- Las credenciales de Supabase para la función se configuran como env vars en Vercel (`SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- No se necesita SSR completo — la combinación de Vercel serverless + Angular Meta cubre el 95% del SEO
- Googlebot renderiza JS, así que los meta tags de Angular funcionan para Google
