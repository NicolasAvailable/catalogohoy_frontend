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

function buildHtml(meta: OgMeta): string {
  const t = escapeHtml(stripHtml(meta.title));
  const d = escapeHtml(truncate(stripHtml(meta.description), 160));
  const i = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);
  const ty = escapeHtml(meta.type);
  const sn = escapeHtml(meta.siteName);

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
</head>
<body>
  <p>${t}</p>
</body>
</html>`;
}

async function supabaseGet<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return Array.isArray(data) ? data[0] ?? null : data;
  } catch {
    return null;
  }
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
    let tenant: { id: number; name: string } | null;

    if (hostname.endsWith('.catalogohoy.com')) {
      const slug = extractSlugFromHost(hostname);
      if (!slug) {
        return new Response(buildHtml(defaultMeta), {
          status: 200,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        });
      }
      baseUrl = `https://${slug}.catalogohoy.com`;
      tenant = await supabaseGet<{ id: number; name: string }>(
        `tenants?slug=eq.${encodeURIComponent(slug)}&select=id,name`
      );
    } else {
      // Dominio personalizado (ej. 3sxpress.com): el tenant se resuelve por
      // custom_domain, igual que hace el guard del frontend (www se ignora
      // porque en la columna se guarda siempre el apex).
      const domain = hostname.replace(/^www\./, '');
      baseUrl = `https://${domain}`;
      tenant = await supabaseGet<{ id: number; name: string }>(
        `tenants?custom_domain=eq.${encodeURIComponent(domain)}&select=id,name`
      );
    }

    if (!tenant) {
      return new Response(buildHtml({ ...defaultMeta, url: baseUrl }), {
        status: 200,
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
      });
    }

    // Fetch ecommerce config
    const config = await supabaseGet<{
      logo: string | null;
      banner: string | null;
      description: string | null;
    }>(
      `tenant_ecommerce_config?tenant_id=eq.${tenant.id}&select=logo,banner,description`
    );

    const tenantLogo = config?.logo || config?.banner || DEFAULT_IMAGE;
    const tenantDescription =
      config?.description ||
      `Explora el catálogo de ${tenant.name} en CatalogoHoy.`;

    // Product page: /product/:id
    const productMatch = pathname.match(/^\/product\/(\d+)/);

    if (productMatch) {
      const productId = productMatch[1];
      const product = await supabaseGet<{
        name: string;
        description: string | null;
        photos: string[] | null;
        price: number;
        price_promotional: number | null;
      }>(
        `products?id=eq.${productId}&select=name,description,photos,price,price_promotional`
      );

      if (product) {
        const productImage =
          product.photos && product.photos.length > 0
            ? product.photos[0]
            : tenantLogo;
        const productDescription =
          product.description ||
          `${product.name} disponible en ${tenant.name}`;
        const price =
          product.price_promotional && product.price_promotional > 0
            ? product.price_promotional
            : product.price;

        return new Response(
          buildHtml({
            title: `${product.name} — ${tenant.name}`,
            description: `$${Number(price).toFixed(2)} · ${productDescription}`,
            image: productImage,
            url: `${baseUrl}/product/${productId}`,
            type: 'product',
            siteName: tenant.name,
          }),
          {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=utf-8' },
          }
        );
      }
    }

    // Default: catalog home
    return new Response(
      buildHtml({
        title: `${tenant.name} — Catálogo`,
        description: tenantDescription,
        image: tenantLogo,
        url: baseUrl,
        type: 'website',
        siteName: tenant.name,
      }),
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
