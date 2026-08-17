import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL =
  process.env['SUPABASE_URL'] || 'https://yvkurjivijnhliofmfmj.supabase.co';
const SUPABASE_KEY =
  process.env['SUPABASE_ANON_KEY'] ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2a3Vyaml2aWpuaGxpb2ZtZm1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjA5NTMsImV4cCI6MjA3ODc5Njk1M30.k-8mP6wBVgw7qnepLUmpB-DqCRsrBu7TJxkI9XPOnTw';

const DEFAULT_IMAGE =
  'https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/favicon-c.png';

const CRAWLER_REGEX =
  /facebookexternalhit|Twitterbot|WhatsApp|LinkedInBot|Slackbot|TelegramBot|Pinterest|Discordbot|Baiduspider|Googlebot|bingbot|yandex|Applebot/i;

/** Máximo de productos listados en el HTML para crawlers de la portada.
 *  Suficiente para dar contenido y enlaces internos sin inflar la respuesta. */
const HOME_PRODUCT_LIMIT = 60;

function extractSlugFromHost(host: string): string | null {
  const hostname = host.split(':')[0];
  const parts = hostname.split('.');
  if (parts.length < 3) return null;
  const subdomain = parts[0];
  if (subdomain === 'www') return null;
  return subdomain;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/** Named HTML entities the rich-text editor commonly emits (Spanish accents,
 *  punctuation, the basic five). Numeric entities are handled separately. */
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  uuml: 'ü', ntilde: 'ñ',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  Uuml: 'Ü', Ntilde: 'Ñ',
  iexcl: '¡', iquest: '¿', ordf: 'ª', ordm: 'º', deg: '°', euro: '€',
  hellip: '…', mdash: '—', ndash: '–', laquo: '«', raquo: '»',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”',
};

/** The catalog/product description is stored as rich-text HTML (`<p>…</p>`,
 *  `&nbsp;`, `&aacute;`, etc.). Social crawlers want plain text, so strip the
 *  tags and decode the entities before it goes into a meta tag. */
function stripHtml(str: string): string {
  return str
    .replace(/<[^>]*>/g, ' ') // drop tags
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(parseInt(n, 10)))
    .replace(/&([a-zA-Z]+);/g, (_, name) =>
      Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name)
        ? NAMED_ENTITIES[name]
        : ' '
    )
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

interface OgMeta {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
  siteName: string;
}

/** Contenido extra para buscadores: cuerpo indexable + datos estructurados
 *  (JSON-LD). Los crawlers sociales (WhatsApp/FB) solo leen los meta tags,
 *  así que agregar cuerpo no cambia los previews. */
interface CrawlerExtras {
  bodyHtml?: string;
  jsonLd?: unknown[];
}

function buildHtml(meta: OgMeta, extras: CrawlerExtras = {}): string {
  const t = escapeHtml(stripHtml(meta.title));
  const d = escapeHtml(truncate(stripHtml(meta.description), 160));
  const i = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);
  const ty = escapeHtml(meta.type);
  const sn = escapeHtml(meta.siteName);

  // `</script>` dentro de un string del JSON rompería el documento.
  const jsonLdBlocks = (extras.jsonLd ?? [])
    .map(
      (obj) =>
        `  <script type="application/ld+json">${JSON.stringify(obj).replace(
          /</g,
          '\\u003c'
        )}</script>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${t}</title>
  <meta name="description" content="${d}" />

  <!-- Open Graph -->
  <meta property="og:title" content="${t}" />
  <meta property="og:description" content="${d}" />
  <meta property="og:image" content="${i}" />
  <meta property="og:url" content="${u}" />
  <meta property="og:type" content="${ty}" />
  <meta property="og:locale" content="es_ES" />
  <meta property="og:site_name" content="${sn}" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${t}" />
  <meta name="twitter:description" content="${d}" />
  <meta name="twitter:image" content="${i}" />

  <link rel="canonical" href="${u}" />
${jsonLdBlocks}
</head>
<body>
${extras.bodyHtml ?? `  <p>${t}</p>`}
</body>
</html>`;
}

async function supabaseGetAll<T>(path: string): Promise<T[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

async function supabaseGet<T>(path: string): Promise<T | null> {
  const rows = await supabaseGetAll<T>(path);
  return rows[0] ?? null;
}

interface ProductRow {
  id: number;
  name: string;
  description: string | null;
  photos: string[] | null;
  price: number | null;
  price_promotional: number | null;
  is_sold_out: boolean | null;
}

function effectivePrice(p: ProductRow): number | null {
  if (p.price_promotional && p.price_promotional > 0) {
    return Number(p.price_promotional);
  }
  // Precio 0 = "sin precio" (consultar por WhatsApp): no se muestra ni va al JSON-LD.
  return p.price != null && Number(p.price) > 0 ? Number(p.price) : null;
}

function formatPrice(value: number | null, currency: string): string {
  if (value == null) return '';
  return `${value.toFixed(2)} ${currency}`;
}

const defaultMeta: OgMeta = {
  title: 'CatalogoHoy — Tu catálogo digital',
  description:
    'Crea tu catálogo online y comparte tus productos con tus clientes.',
  image: DEFAULT_IMAGE,
  url: 'https://catalogohoy.com',
  type: 'website',
  siteName: 'CatalogoHoy',
};

export default async function middleware(request: Request): Promise<Response | undefined> {
  const userAgent = request.headers.get('user-agent') || '';
  const isCrawler = CRAWLER_REGEX.test(userAgent);

  // Non-crawlers pass through to the SPA
  if (!isCrawler) return undefined;

  try {
    const host = request.headers.get('host') || '';
    const url = new URL(request.url);
    const pathname = url.pathname;

    const hostname = host.split(':')[0].toLowerCase();
    let baseUrl: string;
    let tenant: { id: number; name: string; country_code: string | null } | null;

    if (hostname.endsWith('.catalogohoy.com')) {
      const slug = extractSlugFromHost(hostname);
      if (!slug) {
        return new Response(buildHtml(defaultMeta), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      baseUrl = `https://${slug}.catalogohoy.com`;
      tenant = await supabaseGet<{ id: number; name: string; country_code: string | null }>(
        `tenants?slug=eq.${encodeURIComponent(slug)}&select=id,name,country_code`
      );
    } else {
      // Dominio personalizado (ej. 3sxpress.com): el tenant se resuelve por
      // custom_domain, igual que hace el guard del frontend (www se ignora
      // porque en la columna se guarda siempre el apex).
      const domain = hostname.replace(/^www\./, '');
      baseUrl = `https://${domain}`;
      tenant = await supabaseGet<{ id: number; name: string; country_code: string | null }>(
        `tenants?custom_domain=eq.${encodeURIComponent(domain)}&select=id,name,country_code`
      );
    }

    if (!tenant) {
      return new Response(buildHtml({ ...defaultMeta, url: baseUrl }), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Config del catálogo + moneda de los precios (para el JSON-LD), en paralelo.
    const [config, currency] = await Promise.all([
      supabaseGet<{
        logo: string | null;
        banner: string | null;
        description: string | null;
      }>(
        `tenant_ecommerce_config?tenant_id=eq.${tenant.id}&select=logo,banner,description`
      ),
      supabaseGet<{
        product_currency: string | null;
        display_currency: string | null;
      }>(
        `tenant_currency_config?tenant_id=eq.${tenant.id}&select=product_currency,display_currency`
      ),
    ]);

    const tenantLogo = config?.logo || config?.banner || DEFAULT_IMAGE;
    const tenantDescription =
      config?.description ||
      `Explora el catálogo de ${tenant.name} en CatalogoHoy.`;
    // En Venezuela los precios se guardan en la moneda de REFERENCIA
    // (display_currency, normalmente USD); product_currency ahí es la local
    // (VES), que solo se muestra convertida por tasa. En el resto de países
    // product_currency sí es la moneda real de los precios. (Ver gotcha
    // "Moneda del catálogo público".)
    const priceCurrency =
      tenant.country_code === 'VE'
        ? currency?.display_currency || 'USD'
        : currency?.product_currency || 'USD';

    // Product page: /product/:id
    const productMatch = pathname.match(/^\/product\/(\d+)/);

    if (productMatch) {
      const productId = productMatch[1];
      const product = await supabaseGet<ProductRow>(
        `products?id=eq.${productId}&select=id,name,description,photos,price,price_promotional,is_sold_out`
      );

      if (product) {
        const productImage =
          product.photos && product.photos.length > 0
            ? product.photos[0]
            : tenantLogo;
        const productDescription =
          product.description ||
          `${product.name} disponible en ${tenant.name}`;
        const price = effectivePrice(product);
        const productUrl = `${baseUrl}/product/${productId}`;

        const name = escapeHtml(stripHtml(product.name));
        const desc = escapeHtml(stripHtml(productDescription));
        const bodyHtml = [
          `  <main>`,
          `    <h1>${name}</h1>`,
          `    <img src="${escapeHtml(productImage)}" alt="${name}" width="400" />`,
          price != null
            ? `    <p><strong>${formatPrice(price, priceCurrency)}</strong>${
                product.is_sold_out ? ' · Agotado' : ''
              }</p>`
            : '',
          `    <p>${desc}</p>`,
          `    <p><a href="${escapeHtml(baseUrl)}/">Ver todo el catálogo de ${escapeHtml(
            stripHtml(tenant.name)
          )}</a></p>`,
          `  </main>`,
        ]
          .filter(Boolean)
          .join('\n');

        const jsonLd: unknown[] = [
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: stripHtml(product.name),
            description: truncate(stripHtml(productDescription), 500),
            image: product.photos?.length ? product.photos : [productImage],
            url: productUrl,
            ...(price != null
              ? {
                  offers: {
                    '@type': 'Offer',
                    price: price.toFixed(2),
                    priceCurrency,
                    availability: product.is_sold_out
                      ? 'https://schema.org/OutOfStock'
                      : 'https://schema.org/InStock',
                    url: productUrl,
                  },
                }
              : {}),
          },
        ];

        return new Response(
          buildHtml(
            {
              title: `${product.name} — ${tenant.name}`,
              description:
                price != null
                  ? `$${price.toFixed(2)} · ${productDescription}`
                  : productDescription,
              image: productImage,
              url: productUrl,
              type: 'product',
              siteName: tenant.name,
            },
            { bodyHtml, jsonLd }
          ),
          {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }
        );
      }
    }

    // Default: catalog home — lista real de productos para que el buscador
    // tenga contenido indexable y enlaces internos hacia /product/:id.
    const products = await supabaseGetAll<ProductRow>(
      `products?tenant_id=eq.${tenant.id}` +
        `&or=(is_hidden.eq.false,is_hidden.is.null)` +
        `&select=id,name,description,photos,price,price_promotional,is_sold_out` +
        `&order=position.asc.nullslast,id.asc&limit=${HOME_PRODUCT_LIMIT}`
    );

    const storeName = escapeHtml(stripHtml(tenant.name));
    const items = products
      .map((p) => {
        const price = effectivePrice(p);
        const label =
          price != null ? ` — ${formatPrice(price, priceCurrency)}` : '';
        return `      <li><a href="${escapeHtml(baseUrl)}/product/${p.id}">${escapeHtml(
          stripHtml(p.name)
        )}</a>${label}</li>`;
      })
      .join('\n');

    const bodyHtml = [
      `  <main>`,
      `    <h1>${storeName}</h1>`,
      `    <p>${escapeHtml(truncate(stripHtml(tenantDescription), 300))}</p>`,
      products.length
        ? `    <h2>Productos</h2>\n    <ul>\n${items}\n    </ul>`
        : '',
      `  </main>`,
    ]
      .filter(Boolean)
      .join('\n');

    const jsonLd: unknown[] = [
      {
        '@context': 'https://schema.org',
        '@type': 'Store',
        name: stripHtml(tenant.name),
        description: truncate(stripHtml(tenantDescription), 500),
        image: tenantLogo,
        url: baseUrl,
      },
      ...(products.length
        ? [
            {
              '@context': 'https://schema.org',
              '@type': 'ItemList',
              itemListElement: products.map((p, idx) => ({
                '@type': 'ListItem',
                position: idx + 1,
                name: stripHtml(p.name),
                url: `${baseUrl}/product/${p.id}`,
              })),
            },
          ]
        : []),
    ];

    return new Response(
      buildHtml(
        {
          title: `${tenant.name} — Catálogo`,
          description: tenantDescription,
          image: tenantLogo,
          url: baseUrl,
          type: 'website',
          siteName: tenant.name,
        },
        { bodyHtml, jsonLd }
      ),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      }
    );
  } catch {
    return new Response(buildHtml(defaultMeta), {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

export const config = {
  matcher: ['/', '/product/:path*'],
};
