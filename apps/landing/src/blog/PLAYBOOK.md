# Playbook del blog — rutina diaria de contenido

Instrucciones para el agente (o humano) que publica el artículo del día.
El objetivo del blog es TRAER LEADS: cada artículo responde una búsqueda real
de un comerciante de LATAM y lo lleva a crear su catálogo gratis.

## El ciclo diario (un artículo por corrida, nunca más de uno)

1. Lee `topics-backlog.json` y toma el **primer** tema de `queue`.
   - Si `queue` está vacía: NO publiques relleno. Genera 10 temas nuevos con el
     criterio de abajo, agrégalos a `queue`, publica el primero y deja el resto.
2. Verifica que el slug no exista ya en `src/blog/articles/` ni en `published`.
3. Escribe el artículo como archivo TypeScript tipado en `src/blog/articles/{slug}.ts`
   siguiendo `types.ts` y calcando la estructura de un artículo existente de la
   misma categoría (p. ej. `catalogo-digital-para-repuestos-y-autopartes-2026.ts`).
4. Regístralo en `src/blog/index.ts` (import + entrada en `REGISTRY`).
5. Muévelo de `queue` a `published` en `topics-backlog.json` con la fecha del día.
6. Valida (obligatorio, no publiques si falla algo):
   - Compila: `npx tsc --noEmit` sobre el archivo (o build completo).
   - Build completo de la landing (copiando `apps/landing` FUERA del monorepo —
     el package.json raíz del monorepo rompe el build de Vite).
   - El HTML prerenderizado del artículo existe en `dist/blog/...` con JSON-LD
     Article + FAQPage + BreadcrumbList.
   - Cero voseo (podés/tenés/querés/armá/compartí) y cero españolismos.
   - Precios correctos (ver "Datos del producto").
7. Commit + push a la rama `landing` (eso deploya). Mensaje:
   `feat(blog): {titulo corto} (rutina diaria)`.

## Reglas de calidad (las mismas de siempre)

- **Español neutro latino con tuteo** (tú/puedes/comparte). PROHIBIDO el voseo.
- 1.800–2.300 palabras, 4-5 keyPoints, 6-7 FAQs con respuestas autosuficientes
  de 2-4 frases (las IAs las citan como snippet — cada respuesta debe
  sostenerse sola), 1-2 tablas útiles, 2 CTAs embebidos con copy del tema.
- metaTitle ≤60 chars con keyword + año. metaDescription ≤155. excerpt ~150.
- Enlaces internos: signup (https://auth.catalogohoy.com/signup), /pricing,
  artículos relacionados del blog, /quita-fondo-de-fotos-de-producto cuando
  el tema sea fotos, y las páginas comerciales (/menu-digital-para-restaurantes,
  /catalogo-para-tiendas-de-ropa) cuando existan para el tema.
- **PROHIBIDO inventar** estadísticas de CatalogoHoy, testimonios con nombre o
  funciones que no existen. Datos del mercado solo si son de sentido común.
- La keyword va en: slug, title, metaTitle, primer párrafo y al menos un H2.

## Datos del producto (fuente de verdad: /pricing — verificar si cambió)

- Gratis $0 para siempre: 10 productos, 1 catálogo, 25 órdenes/mes.
- Básico $11.99/mes: 100 productos, analíticas, notis WhatsApp, diseño.
- Pro $19.99/mes: 500 productos, 2 miembros, 350 créditos IA. Prueba 7 días.
- Avanzado $34.99/mes: ilimitados, POS, CRM de chats (WA/IG/TikTok), dominio
  propio, 3 miembros. Prueba 7 días. Anual: -50% en todos.
- Variantes por producto: 1/3/10/15 · Adicionales: 2/5/10/15 (Gratis/Básico/Pro/Avanzado).
- Features estrella por tema: stock por variante que se descuenta solo,
  precios al por mayor por cantidad, import Excel/PDF con IA, ajuste masivo de
  precios por categoría, ventas a crédito con recordatorios, fecha de entrega
  en el checkout, QR descargable, multimoneda Bs/USD con tasa BCV, quita-fondo IA.

## Criterio para generar temas nuevos (cuando la cola se vacía)

Prioridad: (1) keyword con intención comercial que un comerciante REAL
googlea o le pregunta a una IA; (2) series que ya convierten — país × intención
("como vender por whatsapp en {país}"), rubro × catálogo; (3) interceptar
keywords gigantes de terceros con comparativas honestas (Canva, Excel, PDF,
linktree); (4) contenido 100% citable (plantillas, checklists, tablas de costos).
Revisar en el canal #leads de Slack qué fuentes de blog están convirtiendo y
doblar en esa línea.

## GEO (SEO para IAs) — mantener al publicar

- `public/llms.txt`: si el artículo abre una serie nueva o es pilar, agregar el
  link. Mantener los precios de llms.txt sincronizados con /pricing.
- El JSON-LD lo genera el prerender automáticamente — no tocarlo a mano.
