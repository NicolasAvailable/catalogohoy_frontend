import type { VercelRequest, VercelResponse } from '@vercel/node';

const SUPABASE_URL =
  process.env['SUPABASE_URL'] || 'https://yvkurjivijnhliofmfmj.supabase.co';
const SUPABASE_KEY =
  process.env['SUPABASE_ANON_KEY'] ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2a3Vyaml2aWpuaGxpb2ZtZm1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjA5NTMsImV4cCI6MjA3ODc5Njk1M30.k-8mP6wBVgw7qnepLUmpB-DqCRsrBu7TJxkI9XPOnTw';

/** Subdominios de la plataforma que nunca son un storefront. */
const RESERVED_SUBDOMAINS = new Set([
  'www',
  'auth',
  'help',
  'internal',
  'api',
  'mail',
]);

async function restGet<T>(path: string): Promise<T[] | null> {
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
    return Array.isArray(data) ? data : null;
  } catch {
    return null;
  }
}

/** Resuelve el tenant dueño del host: subdominio {slug}.catalogohoy.com o
 *  dominio personalizado (en la columna custom_domain se guarda el apex). */
async function resolveTenant(
  hostname: string
): Promise<{ id: number; plan_expired: boolean | null } | null> {
  if (!hostname || hostname === 'catalogohoy.com') return null;

  if (hostname.endsWith('.catalogohoy.com')) {
    const parts = hostname.split('.');
    const subdomain = parts[0];
    if (parts.length < 3 || RESERVED_SUBDOMAINS.has(subdomain)) return null;
    const rows = await restGet<{ id: number; plan_expired: boolean | null }>(
      `tenants?slug=eq.${encodeURIComponent(subdomain)}&select=id,plan_expired`
    );
    return rows?.[0] ?? null;
  }

  const domain = hostname.replace(/^www\./, '');
  const rows = await restGet<{ id: number; plan_expired: boolean | null }>(
    `tenants?custom_domain=eq.${encodeURIComponent(domain)}&select=id,plan_expired`
  );
  return rows?.[0] ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawHost = (req.headers['x-forwarded-host'] ||
    req.headers['host'] ||
    '') as string;
  const hostname = rawHost.split(':')[0].toLowerCase();

  const tenant = await resolveTenant(hostname);
  if (!tenant) {
    return res.status(404).send('Not found');
  }

  const base = `https://${hostname}`;
  const urls: string[] = [
    `  <url>\n    <loc>${base}/</loc>\n    <changefreq>daily</changefreq>\n    <priority>1.0</priority>\n  </url>`,
  ];

  // Catálogo cerrado (toggle del admin) o plan vencido → solo la portada.
  const config = await restGet<{ is_visible: boolean | null }>(
    `tenant_ecommerce_config?tenant_id=eq.${tenant.id}&select=is_visible`
  );
  const catalogOpen =
    tenant.plan_expired !== true && config?.[0]?.is_visible !== false;

  if (catalogOpen) {
    const products = await restGet<{ id: number; created_at: string | null }>(
      `products?tenant_id=eq.${tenant.id}` +
        `&or=(is_hidden.eq.false,is_hidden.is.null)` +
        `&select=id,created_at&order=id.asc&limit=5000`
    );
    for (const p of products ?? []) {
      const lastmod = p.created_at
        ? `\n    <lastmod>${p.created_at.slice(0, 10)}</lastmod>`
        : '';
      urls.push(
        `  <url>\n    <loc>${base}/product/${p.id}</loc>${lastmod}\n    <changefreq>weekly</changefreq>\n    <priority>0.8</priority>\n  </url>`
      );
    }
  }

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${urls.join('\n')}\n` +
    `</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=86400'
  );
  return res.status(200).send(xml);
}
