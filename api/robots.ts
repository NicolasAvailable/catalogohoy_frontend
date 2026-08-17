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

/** ¿El host es un storefront real? Subdominios no reservados se asumen
 *  válidos (si el slug no existe, el sitemap responde 404 igual). Dominios
 *  ajenos (previews *.vercel.app, etc.) solo pasan si son custom_domain
 *  de algún tenant. */
async function isStorefront(hostname: string): Promise<boolean> {
  if (!hostname || hostname === 'catalogohoy.com') return false;

  if (hostname.endsWith('.catalogohoy.com')) {
    const parts = hostname.split('.');
    return parts.length >= 3 && !RESERVED_SUBDOMAINS.has(parts[0]);
  }

  const domain = hostname.replace(/^www\./, '');
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/tenants?custom_domain=eq.${encodeURIComponent(domain)}&select=id`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          Accept: 'application/json',
        },
      }
    );
    if (!res.ok) return false;
    const data = await res.json();
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const rawHost = (req.headers['x-forwarded-host'] ||
    req.headers['host'] ||
    '') as string;
  const hostname = rawHost.split(':')[0].toLowerCase();

  const storefront = await isStorefront(hostname);

  const body = storefront
    ? [
        'User-agent: *',
        'Allow: /',
        'Disallow: /admin/',
        'Disallow: /checkout',
        'Disallow: /order/',
        'Disallow: /public/',
        'Disallow: /catalog-unavailable',
        'Disallow: /no-access',
        '',
        `Sitemap: https://${hostname}/sitemap.xml`,
        '',
      ].join('\n')
    : 'User-agent: *\nDisallow: /\n';

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=3600, stale-while-revalidate=86400'
  );
  return res.status(200).send(body);
}
