import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env['SUPABASE_URL'] || 'https://yvkurjivijnhliofmfmj.supabase.co';
const SUPABASE_KEY = process.env['SUPABASE_ANON_KEY'] || 'sb_publishable_yYkWS23HI8l698Fl-sK12w_FcqIggPs';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const DEFAULT_IMAGE =
  'https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/favicon-c.png';

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

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return str.slice(0, max - 3) + '...';
}

function buildHtml(meta: {
  title: string;
  description: string;
  image: string;
  url: string;
  type: string;
}): string {
  const t = escapeHtml(meta.title);
  const d = escapeHtml(truncate(meta.description, 160));
  const i = escapeHtml(meta.image);
  const u = escapeHtml(meta.url);
  const ty = escapeHtml(meta.type);

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
  <meta property="og:site_name" content="CatalogoHoy" />

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

const defaultMeta = {
  title: 'CatalogoHoy — Tu catálogo digital',
  description: 'Crea tu catálogo online y comparte tus productos con tus clientes.',
  image: DEFAULT_IMAGE,
  url: 'https://catalogohoy.com',
  type: 'website',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const host = (req.headers['host'] || req.headers['x-forwarded-host'] || '') as string;
    const slug = extractSlugFromHost(host);
    const path = (req.query['path'] as string) || '';

    if (!slug) {
      return res.status(200).send(buildHtml(defaultMeta));
    }

    const baseUrl = `https://${slug}.catalogohoy.com`;

    // Fetch tenant by slug
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .eq('slug', slug)
      .single();

    if (tenantError || !tenant) {
      return res.status(200).send(buildHtml({ ...defaultMeta, url: baseUrl }));
    }

    // Fetch ecommerce config
    const { data: config } = await supabase
      .from('tenant_ecommerce_config')
      .select('logo, banner, description')
      .eq('tenant_id', tenant.id)
      .single();

    const tenantLogo = config?.logo || config?.banner || DEFAULT_IMAGE;
    const tenantDescription =
      config?.description || `Explora el catálogo de ${tenant.name} en CatalogoHoy.`;

    // Check if it's a product page: /product/:id
    const productMatch = path.match(/^\/?product\/(\d+)/);

    if (productMatch) {
      const productId = productMatch[1];
      const { data: product } = await supabase
        .from('products')
        .select('name, description, photos, price, price_promotional')
        .eq('id', productId)
        .single();

      if (product) {
        const productImage =
          product.photos && product.photos.length > 0 ? product.photos[0] : tenantLogo;
        const productDescription =
          product.description || `${product.name} disponible en ${tenant.name}`;
        const price =
          product.price_promotional && product.price_promotional > 0
            ? product.price_promotional
            : product.price;

        return res.status(200).send(
          buildHtml({
            title: `${product.name} — ${tenant.name}`,
            description: `$${price.toFixed(2)} · ${productDescription}`,
            image: productImage,
            url: `${baseUrl}/product/${productId}`,
            type: 'product',
          })
        );
      }
    }

    // Default: catalog home
    return res.status(200).send(
      buildHtml({
        title: `${tenant.name} — Catálogo`,
        description: tenantDescription,
        image: tenantLogo,
        url: baseUrl,
        type: 'website',
      })
    );
  } catch (error) {
    // On any error, return default meta tags (never break the crawler)
    return res.status(200).send(buildHtml(defaultMeta));
  }
}
