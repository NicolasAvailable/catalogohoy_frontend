/**
 * Pre-render del blog a HTML estático (SEO).
 *
 * La landing es una SPA: el HTML que recibe un crawler viene vacío y el
 * contenido aparece solo al ejecutar JS. Google lo tolera (lento/peor);
 * Bing, DuckDuckGo, WhatsApp/Facebook (link previews) y los crawlers de IA
 * no ejecutan JS y no ven nada. Este script corre tras `vite build` (plugin
 * en vite.config.ts) y escribe un index.html por cada URL del blog con:
 *   - título, description, canonical y Open Graph/Twitter propios (og:image
 *     por artículo desde /blog/og/<slug>.jpg, generadas por
 *     scripts/generate-og-blog.mjs)
 *   - JSON-LD del artículo (Article + FAQPage + Breadcrumb) en el HTML
 *   - el CONTENIDO COMPLETO dentro de <div id="root"> con las mismas clases
 *     Tailwind del renderer React: el crawler lo lee y, al montar, React lo
 *     reemplaza sin salto visual
 * Vercel sirve archivos existentes ANTES del rewrite SPA, así que
 * dist/blog/<cat>/<slug>/index.html gana a /index.html en esas rutas.
 */
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const BASE_URL = "https://catalogohoy.com";

// ---- 1. Cargar los datos tipados del blog (bundle temporal con esbuild) ----
const tmpFile = path.join(DIST, ".blog-data.mjs");
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

const esc = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// ---- 2. Render estático de bloques (mismas clases que BlogArticle.tsx) ----
const renderBlock = (b, campaign) => {
  switch (b.type) {
    case "p":
      return `<p class="text-base leading-relaxed text-foreground/85">${b.html}</p>`;
    case "h2":
      return `<h2 id="${b.id}" class="font-display font-bold text-2xl mt-10 scroll-mt-28">${esc(b.text)}</h2>`;
    case "h3":
      return `<h3 class="font-display font-semibold text-xl mt-6">${esc(b.text)}</h3>`;
    case "ul":
      return `<ul class="flex flex-col gap-2.5 pl-5 list-disc">${b.items.map((i) => `<li class="text-foreground/85 leading-relaxed">${i}</li>`).join("")}</ul>`;
    case "ol":
      return `<ol class="flex flex-col gap-2.5 list-decimal pl-6">${b.items.map((i) => `<li class="text-foreground/85 leading-relaxed pl-1">${i}</li>`).join("")}</ol>`;
    case "table":
      return `<div class="overflow-x-auto rounded-xl border border-border"><table class="w-full text-sm"><thead><tr class="bg-muted/60">${b.headers
        .map((h) => `<th class="text-left font-semibold px-4 py-3 whitespace-nowrap">${esc(h)}</th>`)
        .join("")}</tr></thead><tbody>${b.rows
        .map(
          (row) =>
            `<tr class="border-t border-border">${row
              .map((c, j) => `<td class="px-4 py-3 ${j === 0 ? "font-medium" : "text-foreground/80"}">${esc(c)}</td>`)
              .join("")}</tr>`
        )
        .join("")}</tbody></table></div>`;
    case "cta":
      return `<div class="rounded-2xl bg-gradient-to-br from-primary to-indigo-600 p-6 md:p-8 text-white my-2"><p class="font-display font-bold text-xl">${esc(b.title)}</p><p class="mt-1.5 text-white/85 text-sm leading-relaxed">${esc(b.text)}</p><a href="https://auth.catalogohoy.com/signup?utm_source=blog&amp;utm_medium=cta&amp;utm_campaign=${campaign}" class="inline-flex items-center gap-2 mt-4 bg-white text-primary font-semibold text-sm rounded-full px-5 py-2.5">${esc(b.button)}</a></div>`;
    case "quote":
      return `<blockquote class="border-l-4 border-primary pl-4 italic text-foreground/75">${esc(b.text)}</blockquote>`;
    case "img":
      return `<figure class="my-2"><img src="${b.src}" alt="${esc(b.alt)}" loading="lazy" class="w-full rounded-2xl border border-border">${b.caption ? `<figcaption class="mt-2 text-center text-xs text-muted-foreground">${esc(b.caption)}</figcaption>` : ""}</figure>`;
    default:
      return "";
  }
};

const articleBody = (a, category) => {
  const toc = a.blocks.filter((b) => b.type === "h2");
  return `<main class="pt-28 pb-20"><article class="container mx-auto px-4 max-w-3xl">
<nav class="text-sm text-muted-foreground" aria-label="breadcrumb"><a href="/">Inicio</a> › <a href="/blog">Blog</a> › <a href="/blog/${category.slug}">${esc(category.name)}</a></nav>
<h1 class="font-display font-extrabold text-3xl md:text-4xl leading-tight mt-6">${esc(a.title)}</h1>
<p class="text-sm text-muted-foreground mt-3">${esc(a.author)} · ${a.readMinutes} min de lectura · <time datetime="${a.date}">${a.date}</time></p>
<section class="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6"><h2 class="font-display font-bold text-lg">Puntos clave</h2><ul class="mt-3 flex flex-col gap-2.5 list-disc pl-5">${a.keyPoints.map((p) => `<li class="text-sm leading-relaxed text-foreground/85">${esc(p)}</li>`).join("")}</ul></section>
<nav class="mt-6 rounded-2xl border border-border p-6" aria-label="Tabla de contenidos"><h2 class="font-display font-bold text-lg">En este artículo</h2><ol class="mt-3 flex flex-col gap-2 list-decimal pl-5">${toc.map((h) => `<li><a class="text-sm text-foreground/80" href="#${h.id}">${esc(h.text)}</a></li>`).join("")}</ol></nav>
<div class="mt-8 flex flex-col gap-5">${a.blocks.map((b) => renderBlock(b, a.slug)).join("\n")}</div>
<section id="faq" class="mt-12"><h2 class="font-display font-bold text-2xl">Preguntas frecuentes</h2><div class="mt-4 flex flex-col gap-3">${a.faqs.map((f) => `<details class="rounded-xl border border-border p-5"><summary class="font-semibold">${esc(f.q)}</summary><p class="mt-3 text-sm text-foreground/80 leading-relaxed">${esc(f.a)}</p></details>`).join("")}</div></section>
${a.sources?.length ? `<section class="mt-10 text-xs text-muted-foreground"><h2 class="font-semibold text-sm">Fuentes</h2><ul class="mt-2 flex flex-col gap-1 list-disc pl-5">${a.sources.map((s) => `<li>${esc(s)}</li>`).join("")}</ul></section>` : ""}
<section class="mt-12"><h2 class="font-display font-bold text-2xl">Sigue leyendo</h2><ul class="mt-4 flex flex-col gap-2 list-disc pl-5">${ARTICLES.filter((r) => r.slug !== a.slug)
    .slice(0, 3)
    .map((r) => `<li><a href="/blog/${r.category}/${r.slug}">${esc(r.title)}</a></li>`)
    .join("")}</ul></section>
</article></main>`;
};

const indexBody = (category) => {
  const list = category ? ARTICLES.filter((a) => a.category === category.slug) : ARTICLES;
  return `<main class="pt-28 pb-20"><div class="container mx-auto px-4 max-w-6xl">
<h1 class="font-display font-extrabold text-4xl">${category ? esc(category.name) : "Blog de CatalogoHoy"}</h1>
<p class="mt-3 text-lg text-muted-foreground">${esc(category ? category.description : "Consejos, guías y recursos para crear tu catálogo digital, vender por WhatsApp y hacer crecer tu negocio en Latinoamérica.")}</p>
<nav class="mt-6" aria-label="Categorías"><ul class="flex flex-wrap gap-3">${CATEGORIES.map((c) => `<li><a href="/blog/${c.slug}">${esc(c.name)}</a></li>`).join("")}</ul></nav>
<div class="mt-8 flex flex-col gap-6">${list
    .map(
      (a) => `<article class="rounded-2xl border border-border p-6"><h2 class="font-display font-bold text-xl"><a href="/blog/${a.category}/${a.slug}">${esc(a.title)}</a></h2><p class="mt-2 text-muted-foreground">${esc(a.excerpt)}</p><p class="mt-2 text-sm text-muted-foreground">${a.readMinutes} min de lectura · <time datetime="${a.date}">${a.date}</time></p></article>`
    )
    .join("\n")}</div>
</div></main>`;
};

// ---- 3. Meta tags: limpiar los de la home e inyectar los de la página ----
const stripBetween = (html, startMarker, endMarker) => {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) throw new Error(`Anclas no encontradas: ${startMarker}`);
  return html.slice(0, start) + html.slice(end);
};

const buildPage = (template, { title, description, urlPath, ogImage, ogType, jsonLd, body }) => {
  let html = template;
  const url = BASE_URL + urlPath;
  // Fuera los OG/Twitter y JSON-LD específicos de la home (Organization se queda)
  html = stripBetween(html, "<!-- Open Graph -->", "<!-- JSON-LD: Organization -->");
  html = stripBetween(html, "<!-- JSON-LD: SoftwareApplication -->", "<!-- Meta Pixel Code -->");
  html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`);
  html = html.replace(/<meta\s+name="description"[\s\S]*?\/>/, `<meta name="description" content="${esc(description)}" />`);
  const head = `<link rel="canonical" href="${url}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:type" content="${ogType}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:site_name" content="CatalogoHoy" />
    <meta property="og:locale" content="es_ES" />
    <meta property="og:image" content="${BASE_URL}${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${BASE_URL}${ogImage}" />
    <script type="application/ld+json">${JSON.stringify(jsonLd)}</script>
  </head>`;
  html = html.replace("</head>", head);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
};

// ---- 4. Generar las páginas ----
const template = await readFile(path.join(DIST, "index.html"), "utf8");
const writePage = async (urlPath, html) => {
  const dir = path.join(DIST, urlPath.replace(/^\//, ""));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html);
};

const blogJsonLd = (name, urlPath, description) => ({
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  name,
  description,
  url: BASE_URL + urlPath,
  inLanguage: "es",
});

await writePage(
  "/blog",
  buildPage(template, {
    title: "Blog de CatalogoHoy: guías para vender más por WhatsApp",
    description:
      "Consejos, guías y recursos para crear tu catálogo digital, vender por WhatsApp y hacer crecer tu negocio en Latinoamérica.",
    urlPath: "/blog",
    ogImage: "/blog/og/og-blog-index.jpg",
    ogType: "website",
    jsonLd: blogJsonLd("Blog de CatalogoHoy", "/blog", "Guías para vender más por WhatsApp"),
    body: indexBody(null),
  })
);

for (const c of CATEGORIES) {
  await writePage(
    `/blog/${c.slug}`,
    buildPage(template, {
      title: `${c.name} — Blog de CatalogoHoy`,
      description: c.description,
      urlPath: `/blog/${c.slug}`,
      ogImage: "/blog/og/og-blog-index.jpg",
      ogType: "website",
      jsonLd: blogJsonLd(`${c.name} — Blog de CatalogoHoy`, `/blog/${c.slug}`, c.description),
      body: indexBody(c),
    })
  );
}

for (const a of ARTICLES) {
  const category = CATEGORIES.find((c) => c.slug === a.category);
  const urlPath = `/blog/${a.category}/${a.slug}`;
  const ogImage = `/blog/og/${a.slug}.jpg`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: a.title,
      description: a.metaDescription,
      image: BASE_URL + ogImage,
      datePublished: a.date,
      dateModified: a.date,
      inLanguage: "es",
      author: { "@type": "Organization", name: a.author, url: BASE_URL },
      publisher: { "@type": "Organization", name: "CatalogoHoy", url: BASE_URL },
      mainEntityOfPage: BASE_URL + urlPath,
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: a.faqs.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Inicio", item: BASE_URL },
        { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog` },
        { "@type": "ListItem", position: 3, name: category.name, item: `${BASE_URL}/blog/${category.slug}` },
        { "@type": "ListItem", position: 4, name: a.title, item: BASE_URL + urlPath },
      ],
    },
  ];
  await writePage(
    urlPath,
    buildPage(template, {
      title: a.metaTitle,
      description: a.metaDescription,
      urlPath,
      ogImage,
      ogType: "article",
      jsonLd,
      body: articleBody(a, category),
    })
  );
}

console.log(`[prerender-blog] ${1 + CATEGORIES.length + ARTICLES.length} páginas estáticas generadas en dist/blog`);
