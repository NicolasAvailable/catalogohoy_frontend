/**
 * Genera las OG images (1200x630) del blog en public/blog/og/*.jpg con el
 * mismo lenguaje visual de BlogCover (foto izquierda + panel diagonal
 * degradado por categoría + título en dos tonos + marca).
 *
 * SE CORRE LOCAL (necesita Playwright, que no está en el build de Vercel) y
 * las imágenes se commitean. Correr de nuevo al agregar artículos:
 *   node scripts/generate-og-blog.mjs   (desde apps/landing, con las
 *   dependencias del repo principal disponibles para playwright)
 */
import { build } from "esbuild";
import { chromium } from "playwright";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "public/blog/og");

const tmpFile = path.join(ROOT, ".blog-data-og.mjs");
await build({
  entryPoints: [path.join(ROOT, "src/blog/index.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  logLevel: "silent",
});
const { ARTICLES, CATEGORIES } = await import(tmpFile);
await rm(tmpFile);

// Mismos degradados que BlogCover.tsx (hex de los tokens Tailwind usados)
const GRADIENTS = {
  "ventas-por-whatsapp": ["#059669", "#10b981", "#14b8a6"],
  "catalogo-digital": ["#6366f1", "#6366f1", "#8b5cf6"],
  emprender: ["#c026d3", "#9333ea", "#4f46e5"],
};
const gradientFor = (cat) => GRADIENTS[cat] ?? GRADIENTS["catalogo-digital"];

const esc = (s) => s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

const splitTitle = (a) => {
  const title = a.coverTitle ?? a.title;
  const accent = a.coverAccent;
  if (accent && title.toLowerCase().endsWith(accent.toLowerCase()))
    return [title.slice(0, title.length - accent.length).trimEnd(), accent];
  return [title, ""];
};

const pageHtml = (a) => {
  const [g1, g2, g3] = gradientFor(a.category);
  const [main, accent] = splitTitle(a);
  const category = CATEGORIES.find((c) => c.slug === a.category);
  const photo = a.coverImage ? `<img src="http://localhost:0${a.coverImage}" onerror="this.remove()">` : "";
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin: 0; box-sizing: border-box; }
  body { width: 1200px; height: 630px; overflow: hidden; position: relative;
         font-family: -apple-system, "Segoe UI", sans-serif; background: #f1f5f9; }
  .photo { position: absolute; inset: 0; }
  .photo img { width: 100%; height: 100%; object-fit: cover; }
  .grid { position: absolute; inset: 0; opacity: .3;
    background-image: linear-gradient(rgba(100,116,139,.14) 2px, transparent 2px),
      linear-gradient(90deg, rgba(100,116,139,.14) 2px, transparent 2px);
    background-size: 40px 40px; }
  .panel { position: absolute; top: 0; right: 0; bottom: 0; width: 68%;
    background: linear-gradient(135deg, ${g1}, ${g2}, ${g3});
    clip-path: polygon(22% 0, 100% 0, 100% 100%, 0 100%);
    display: flex; flex-direction: column; justify-content: center;
    padding: 0 70px 0 26%; gap: 22px; }
  .glow { position: absolute; top: -120px; right: -80px; width: 340px; height: 340px;
    background: rgba(255,255,255,.14); border-radius: 999px; filter: blur(50px); }
  h1 { color: #fff; font-size: 68px; line-height: 1.12; font-weight: 800; letter-spacing: -.01em; }
  h1 span { color: rgba(255,255,255,.68); }
  .tag { color: rgba(255,255,255,.88); font-size: 26px; font-weight: 600; }
  .brand { position: absolute; bottom: 44px; right: 70px; color: #fff; font-size: 30px;
    font-weight: 800; display: flex; align-items: center; gap: 12px; }
  .brand em { font-style: normal; background: #fff; color: ${g1}; border-radius: 12px;
    padding: 2px 10px; font-size: 24px; }
  .chip { position: absolute; bottom: 44px; left: 44px; background: rgba(15,23,42,.5);
    color: #fff; font-size: 22px; font-weight: 600; border-radius: 999px;
    padding: 10px 24px; backdrop-filter: blur(4px); }
</style></head><body>
  <div class="photo">${photo}</div>
  <div class="grid"></div>
  <div class="panel"><div class="glow"></div>
    <h1>${esc(main)}${accent ? ` <span>${esc(accent)}</span>` : ""}</h1>
    ${a.coverTagline ? `<p class="tag">${esc(a.coverTagline)}</p>` : ""}
    <div class="brand"><em>▤</em> CatalogoHoy</div>
  </div>
  ${category ? `<div class="chip">${esc(category.name)}</div>` : ""}
</body></html>`;
};

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });

// Sirve las fotos de public/ vía file:// no funciona con <img src>: usamos
// una página por archivo temporal y rutas relativas al public/.
const renderTo = async (article, outName) => {
  const html = pageHtml(article).replaceAll("http://localhost:0/blog/", path.join(ROOT, "public/blog/") );
  const tmp = path.join(ROOT, "public", `.og-tmp.html`);
  await writeFile(tmp, html);
  await page.goto(`file://${tmp}`, { waitUntil: "networkidle" });
  await page.screenshot({ path: path.join(OUT, outName), type: "jpeg", quality: 82 });
  await rm(tmp);
};

for (const a of ARTICLES) {
  await renderTo(a, `${a.slug}.jpg`);
  console.log(`og ✓ ${a.slug}`);
}

// Genérica para el índice y las categorías
await renderTo(
  {
    category: "catalogo-digital",
    coverTitle: "Blog de CatalogoHoy",
    coverAccent: "CatalogoHoy",
    coverTagline: "Guías para vender más por WhatsApp",
    title: "Blog de CatalogoHoy",
    coverImage: "/blog/vendedor-mostrador.jpg",
  },
  "og-blog-index.jpg"
);
console.log("og ✓ og-blog-index");

await browser.close();
console.log(`[generate-og-blog] ${ARTICLES.length + 1} imágenes en public/blog/og`);
