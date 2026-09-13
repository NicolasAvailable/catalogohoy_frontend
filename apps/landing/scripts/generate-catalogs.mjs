/**
 * Genera, a partir de la BASE DE DATOS (no manual), dos cosas para que Google
 * descubra e indexe los catálogos de los clientes:
 *
 *   1) dist/catalogos.xml  → <sitemapindex> con el sitemap de CADA catálogo
 *      activo+visible. Resuelve el "no se ha detectado ningún sitemap de
 *      referencia" de Search Console. Se envía UNA vez a GSC; los catálogos
 *      nuevos entran solos en el próximo build.
 *   2) dist/tiendas/**     → directorio público PAGINADO (HTML estático
 *      autónomo, sin la SPA) que ENLAZA cada catálogo. Resuelve el "no se ha
 *      detectado ninguna página de referencia" (la causa del "rastreada,
 *      actualmente sin indexar"): le da a cada tienda un backlink desde un
 *      dominio con autoridad.
 *
 * Corre en el build del landing (plugin en vite.config.ts). Lee la lista de
 * tenants con la anon key (RLS permite listar catálogos públicos).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const BASE_URL = "https://catalogohoy.com";
const PER_PAGE = 90;

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://yvkurjivijnhliofmfmj.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2a3Vyaml2aWpuaGxpb2ZtZm1qIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMyMjA5NTMsImV4cCI6MjA3ODc5Njk1M30.k-8mP6wBVgw7qnepLUmpB-DqCRsrBu7TJxkI9XPOnTw";

const esc = (s = "") =>
  String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/** Trae TODAS las filas de un endpoint REST paginando de a 1000. */
async function restAll(pathQ) {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${pathQ}&limit=1000&offset=${offset}`, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error(`REST ${res.status} en ${pathQ}`);
    const chunk = await res.json();
    rows.push(...chunk);
    if (chunk.length < 1000) break;
  }
  return rows;
}

// ---- 1. Cargar catálogos "de calidad" (RPC public_catalogs: activos +
//         visibles + con nombre real + con ≥1 producto no oculto). Filtra la
//         basura/vacíos que no aportan a SEO. ----
const rows = await restAll(
  "rpc/public_catalogs?select=slug,name,custom_domain,description,logo"
);

const catalogs = rows
  .map((t) => {
    const host = t.custom_domain
      ? `https://${t.custom_domain}`
      : `https://${t.slug}.catalogohoy.com`;
    return {
      name: (t.name || t.slug).trim(),
      url: host,
      sitemap: `${host}/sitemap.xml`,
      description: (t.description || "").replace(/\s+/g, " ").trim().slice(0, 160),
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name, "es"));

// ---- 2. Sitemap índice (dist/catalogos.xml) ----
const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${catalogs.map((c) => `  <sitemap><loc>${esc(c.sitemap)}</loc></sitemap>`).join("\n")}
</sitemapindex>
`;
await writeFile(path.join(DIST, "catalogos.xml"), sitemapIndex);

// ---- 3. Directorio público paginado (dist/tiendas/**) ----
const totalPages = Math.max(1, Math.ceil(catalogs.length / PER_PAGE));

const pageHtml = (pageCatalogs, page) => {
  const urlPath = page === 1 ? "/tiendas" : `/tiendas/${page}`;
  const canonical = BASE_URL + urlPath;
  const title =
    page === 1
      ? "Directorio de catálogos y tiendas online | CatalogoHoy"
      : `Catálogos y tiendas online (página ${page}) | CatalogoHoy`;
  const description =
    "Explora catálogos digitales de tiendas y negocios que venden por WhatsApp con CatalogoHoy: ropa, calzado, accesorios, comida y más en Latinoamérica.";
  const cards = pageCatalogs
    .map(
      (c) => `      <li class="card">
        <a href="${esc(c.url)}" rel="noopener"><h2>${esc(c.name)}</h2></a>
        ${c.description ? `<p>${esc(c.description)}</p>` : ""}
        <a class="visit" href="${esc(c.url)}" rel="noopener">Ver catálogo →</a>
      </li>`
    )
    .join("\n");
  const pager = [];
  if (page > 1) pager.push(`<a rel="prev" href="${page - 1 === 1 ? "/tiendas" : `/tiendas/${page - 1}`}">← Anterior</a>`);
  if (page < totalPages) pager.push(`<a rel="next" href="/tiendas/${page + 1}">Siguiente →</a>`);
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Directorio de catálogos — CatalogoHoy",
    url: canonical,
    inLanguage: "es",
    hasPart: pageCatalogs.map((c) => ({ "@type": "WebSite", name: c.name, url: c.url })),
  };
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}" />
<link rel="canonical" href="${canonical}" />
<meta name="robots" content="index, follow" />
<link rel="icon" type="image/png" href="/favicon.png" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(description)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${canonical}" />
<meta property="og:image" content="${BASE_URL}/og-image.png" />
<meta property="og:locale" content="es_MX" />
<script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
<style>
  :root{--ink:#191f2e;--muted:#5b6478;--primary:#1f68f9;--border:#e4e7f0;--bg:#f6f7fb}
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;line-height:1.5}
  .wrap{max-width:1040px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
  header a.brand{display:inline-flex;align-items:center;gap:.5rem;font-weight:700;color:var(--ink);text-decoration:none;font-size:1.1rem}
  h1{font-size:1.9rem;letter-spacing:-.02em;margin:1.25rem 0 .4rem}
  .lede{color:var(--muted);margin:0 0 .5rem;max-width:60ch}
  .count{color:var(--muted);font-size:.85rem;margin:0 0 1.5rem}
  ul.grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem}
  .card{background:#fff;border:1px solid var(--border);border-radius:.9rem;padding:1.1rem}
  .card h2{font-size:1.05rem;margin:0 0 .35rem;color:var(--ink)}
  .card a{text-decoration:none;color:inherit}
  .card p{color:var(--muted);font-size:.85rem;margin:0 0 .6rem}
  .card a.visit{color:var(--primary);font-weight:600;font-size:.85rem}
  nav.pager{display:flex;justify-content:center;gap:1.5rem;margin-top:2.5rem}
  nav.pager a{color:var(--primary);font-weight:600;text-decoration:none}
  footer{margin-top:3rem;color:var(--muted);font-size:.82rem;text-align:center}
  footer a{color:var(--primary)}
</style>
</head>
<body>
  <div class="wrap">
    <header><a class="brand" href="/"><img src="/favicon.png" alt="" width="24" height="24" /> CatalogoHoy</a></header>
    <h1>Directorio de catálogos${page > 1 ? ` · página ${page}` : ""}</h1>
    <p class="lede">${esc(description)}</p>
    <p class="count">${catalogs.length.toLocaleString("es")} catálogos${totalPages > 1 ? ` · página ${page} de ${totalPages}` : ""}</p>
    <ul class="grid">
${cards}
    </ul>
    ${pager.length ? `<nav class="pager">${pager.join("")}</nav>` : ""}
    <footer>¿Querés tu propio catálogo? <a href="https://auth.catalogohoy.com/signup?utm_source=directorio&utm_medium=seo">Crealo gratis en CatalogoHoy →</a></footer>
  </div>
</body>
</html>
`;
};

for (let page = 1; page <= totalPages; page++) {
  const slice = catalogs.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const dir = page === 1 ? path.join(DIST, "tiendas") : path.join(DIST, "tiendas", String(page));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), pageHtml(slice, page));
}

console.log(
  `[generate-catalogs] ${catalogs.length} catálogos → catalogos.xml (sitemap índice) + /tiendas (${totalPages} páginas)`
);
