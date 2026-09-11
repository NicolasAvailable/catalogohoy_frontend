/**
 * Pre-render de las páginas de marketing/SEO a HTML estático.
 *
 * La landing es una SPA (createRoot, NO hydrateRoot): el HTML que recibe un
 * crawler sin JS viene vacío, así que Bing, DuckDuckGo, WhatsApp/Facebook (link
 * previews) y los crawlers de IA no ven nada. Vercel, además, sirve a esas
 * rutas el index.html de la HOME → el contenido real es invisible.
 *
 * Este script corre tras `vite build` (plugin en vite.config.ts), DESPUÉS del
 * prerender del blog, y escribe un index.html por cada ruta de marketing con:
 *   - <title>, description, canonical y Open Graph/Twitter propios
 *   - JSON-LD por página (WebPage + BreadcrumbList; FAQPage donde hay FAQ;
 *     Offers de los 4 planes en /pricing; HowTo en las guías)
 *   - el CONTENIDO fiel dentro de <div id="root"> con las mismas clases
 *     Tailwind que los componentes React: el crawler lo lee y, al montar,
 *     React lo reemplaza sin salto visual (createRoot ⇒ sin riesgo de hidratación).
 * Vercel sirve archivos existentes ANTES del rewrite SPA, así que
 * dist/<ruta>/index.html gana a /index.html en esas rutas.
 *
 * Es autocontenido a propósito (copia los pequeños helpers de prerender-blog):
 * así el blog y las páginas evolucionan sin pisarse.
 */
import { build } from "esbuild";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const BASE_URL = "https://catalogohoy.com";
const SIGNUP = "https://auth.catalogohoy.com/signup";
const DEFAULT_OG = "/og-image.png"; // no hay OG por página; se usa el de la home

// ---- 1. Cargar los FAQ tipados (bundle temporal con esbuild, como el blog) ----
const tmpFile = path.join(DIST, ".faqs-data.mjs");
await build({
  entryPoints: [path.join(ROOT, "src/data/faqs.ts")],
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: tmpFile,
  logLevel: "silent",
});
const { faqs } = await import(tmpFile);
await rm(tmpFile);
// Normaliza al shape {q, a} que usan los helpers de abajo.
const HOME_FAQS = faqs.map((f) => ({ q: f.question, a: f.answer }));

const esc = (s) =>
  s.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

// ---- 2. Helpers de render (mismas clases Tailwind que los componentes) ------
const cta = (campaign, label) =>
  `<a href="${SIGNUP}?utm_source=landing&amp;utm_medium=seo&amp;utm_campaign=${campaign}" class="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground">${esc(label)}</a>`;

const hero = (h1, subtitle, campaign, label) =>
  `<section class="pt-32 pb-10 md:pt-40"><div class="container mx-auto px-4 max-w-3xl text-center">` +
  `<h1 class="font-display font-extrabold text-4xl md:text-5xl text-foreground leading-tight">${esc(h1)}</h1>` +
  `<p class="mt-5 text-lg text-muted-foreground">${esc(subtitle)}</p>` +
  `<div class="mt-8 flex justify-center">${cta(campaign, label)}</div>` +
  `</div></section>`;

const prose = (h2, paragraphs) =>
  `<section class="py-12"><div class="container mx-auto px-4 max-w-3xl">` +
  `<h2 class="font-display font-bold text-2xl md:text-3xl text-foreground">${esc(h2)}</h2>` +
  paragraphs.map((p) => `<p class="mt-4 text-muted-foreground leading-relaxed">${esc(p)}</p>`).join("") +
  `</div></section>`;

const stepsSection = (h2, items) =>
  `<section class="py-12 bg-card border-y border-border"><div class="container mx-auto px-4 max-w-4xl">` +
  `<h2 class="font-display font-bold text-2xl md:text-3xl text-foreground text-center">${esc(h2)}</h2>` +
  `<ol class="mt-10 grid gap-6 sm:grid-cols-2">` +
  items
    .map(
      (s, i) =>
        `<li class="flex gap-4"><span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground">${i + 1}</span>` +
        `<div><h3 class="font-semibold text-foreground">${esc(s.title)}</h3><p class="mt-1 text-sm text-muted-foreground leading-relaxed">${esc(s.text)}</p></div></li>`
    )
    .join("") +
  `</ol></div></section>`;

const cardsSection = (h2, items, intro) =>
  `<section class="py-12"><div class="container mx-auto px-4 max-w-4xl">` +
  `<h2 class="font-display font-bold text-2xl md:text-3xl text-foreground text-center">${esc(h2)}</h2>` +
  (intro ? `<p class="mt-4 text-center text-muted-foreground max-w-2xl mx-auto">${esc(intro)}</p>` : "") +
  `<div class="mt-10 grid gap-6 sm:grid-cols-2">` +
  items
    .map(
      (b) =>
        `<div class="rounded-xl border border-border bg-card p-6"><h3 class="font-semibold text-foreground">${esc(b.title)}</h3><p class="mt-2 text-sm text-muted-foreground leading-relaxed">${esc(b.text)}</p></div>`
    )
    .join("") +
  `</div></div></section>`;

const nichesSection = (h2, intro, items) =>
  `<section class="py-12 bg-card border-y border-border"><div class="container mx-auto px-4 max-w-3xl text-center">` +
  `<h2 class="font-display font-bold text-2xl md:text-3xl text-foreground">${esc(h2)}</h2>` +
  `<p class="mt-4 text-muted-foreground">${esc(intro)}</p>` +
  `<ul class="mt-6 flex flex-wrap justify-center gap-3">` +
  items
    .map(
      (n) =>
        `<li class="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground">${esc(n)}</li>`
    )
    .join("") +
  `</ul></div></section>`;

const faqSection = (items) =>
  `<section class="py-12"><div class="container mx-auto px-4 max-w-3xl">` +
  `<h2 class="font-display font-bold text-2xl md:text-3xl text-foreground text-center">Preguntas frecuentes</h2>` +
  `<div class="mt-8 flex flex-col gap-3">` +
  items
    .map(
      (f) =>
        `<details class="rounded-xl border border-border bg-card p-6"><summary class="font-semibold text-foreground cursor-pointer">${esc(f.q)}</summary><p class="mt-3 text-sm text-muted-foreground leading-relaxed">${esc(f.a)}</p></details>`
    )
    .join("") +
  `</div></div></section>`;

const closingCta = (campaign) =>
  `<section class="py-16"><div class="container mx-auto px-4 max-w-4xl">` +
  `<div class="rounded-3xl bg-gradient-to-br from-primary to-indigo-600 px-8 py-16 md:px-16 md:py-20 text-center">` +
  `<h2 class="font-display font-extrabold text-3xl md:text-4xl text-white leading-tight">Empieza a vender online hoy</h2>` +
  `<p class="mt-4 text-white/80 text-lg max-w-xl mx-auto">Crea tu catálogo digital en minutos y compártelo con tus clientes por WhatsApp.</p>` +
  `<div class="mt-8 flex justify-center"><a href="${SIGNUP}?utm_source=landing&amp;utm_medium=seo&amp;utm_campaign=${campaign}" class="inline-flex items-center justify-center rounded-full bg-white px-8 py-3.5 text-base font-semibold text-primary">Comenzar gratis</a></div>` +
  `</div></div></section>`;

// Página SEO estándar (guías): hero + contexto + pasos + beneficios + nichos + FAQ.
const guideBody = (p) =>
  `<main>` +
  hero(p.h1, p.subtitle, p.campaign, p.ctaLabel) +
  prose(p.contextH2, p.contextParagraphs) +
  stepsSection(p.stepsH2, p.steps) +
  cardsSection(p.benefitsH2, p.benefits, p.benefitsIntro) +
  (p.niches ? nichesSection(p.niches.h2, p.niches.intro, p.niches.items) : "") +
  faqSection(p.faqs) +
  closingCta(p.campaign) +
  `</main>`;

// ---- 3. Builders de JSON-LD ------------------------------------------------
const webPageLd = (name, description, url) => ({
  "@context": "https://schema.org",
  "@type": "WebPage",
  name,
  description,
  url,
  inLanguage: "es",
  isPartOf: { "@type": "WebSite", name: "CatalogoHoy", url: BASE_URL },
});

const breadcrumbLd = (name, url) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: BASE_URL },
    { "@type": "ListItem", position: 2, name, item: url },
  ],
});

const faqLd = (items) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
});

const howToLd = (name, description, steps) => ({
  "@context": "https://schema.org",
  "@type": "HowTo",
  name,
  description,
  step: steps.map((s, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: s.title,
    text: s.text,
  })),
});

// ---- 4. Meta tags: limpiar los de la home e inyectar los de la página ------
// (idéntico a prerender-blog.mjs; duplicado a propósito para independencia)
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
    <meta property="og:locale" content="es_MX" />
    <meta property="og:image" content="${BASE_URL}${ogImage}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${BASE_URL}${ogImage}" />
    ${(Array.isArray(jsonLd) ? jsonLd : [jsonLd]).map((ld) => `<script type="application/ld+json">${JSON.stringify(ld)}</script>`).join("\n    ")}
  </head>`;
  html = html.replace("</head>", head);
  html = html.replace('<div id="root"></div>', `<div id="root">${body}</div>`);
  return html;
};

const template = await readFile(path.join(DIST, "index.html"), "utf8");
const writePage = async (urlPath, html) => {
  const dir = path.join(DIST, urlPath.replace(/^\//, ""));
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, "index.html"), html);
};

// ---- 5. Datos de las páginas -----------------------------------------------

// /pricing — planes con precios reales (Pricing.tsx). Los Offers del JSON-LD
// usan el resumen que pide el brief.
const PLANS = [
  {
    name: "Gratis",
    price: "$0",
    period: "por siempre",
    description: "Para empezar a probar tu catálogo.",
    features: [
      "Hasta 10 productos",
      "1 catálogo",
      "Hasta 25 órdenes por mes",
      "15 créditos de IA por mes",
      "1 reporte por mes",
    ],
  },
  {
    name: "Básico",
    price: "$11.99",
    period: "/mes · USD",
    description: "Para tiendas que quieren crecer.",
    features: [
      "Hasta 100 productos",
      "1 miembro de equipo",
      "Órdenes ilimitadas",
      "Analíticas del catálogo",
      "Notificaciones WhatsApp de órdenes",
      "200 créditos de IA por mes",
      "Diseño personalizable",
      "Soporte prioritario",
    ],
  },
  {
    name: "Pro",
    price: "$19.99",
    period: "/mes · USD",
    description: "Para tiendas grandes que venden todos los días.",
    popular: true,
    features: [
      "Hasta 500 productos",
      "Hasta 2 miembros de equipo",
      "Todo lo del plan Básico",
      "350 créditos de IA por mes",
      "Hasta 20 reportes por mes",
      "10 variantes y 10 adicionales por producto",
    ],
  },
  {
    name: "Avanzado",
    price: "$29.99",
    period: "/mes · USD",
    description: "Para negocios con muchos productos.",
    features: [
      "Productos ilimitados",
      "Hasta 3 miembros de equipo",
      "Todo lo del plan Pro",
      "CRM de chats: WhatsApp, Instagram y TikTok",
      "500 créditos de IA por mes",
      "Dominio propio",
      "Soporte dedicado",
    ],
  },
];

const PRICING_OFFERS = [
  { name: "Plan Gratis", price: "0", description: "Hasta 10 productos, 1 catálogo" },
  {
    name: "Plan Básico",
    price: "11.99",
    description: "Hasta 100 productos, analíticas, notificaciones WhatsApp y diseño personalizable",
  },
  {
    name: "Plan Pro",
    price: "19.99",
    description: "Hasta 500 productos, 2 miembros de equipo y 350 créditos de IA por mes",
  },
  {
    name: "Plan Avanzado",
    price: "29.99",
    description: "Productos ilimitados, dominio propio, hasta 10 miembros de equipo y soporte dedicado",
  },
];

const planCard = (p) =>
  `<div class="rounded-2xl bg-card border ${p.popular ? "border-primary" : "border-border"} p-6 flex flex-col">` +
  `<div class="flex items-center justify-between gap-3"><h3 class="font-display font-bold text-xl text-foreground">${esc(p.name)}</h3>${p.popular ? `<span class="inline-flex items-center rounded-full bg-primary/10 text-primary text-xs font-semibold px-3 py-1">Más popular</span>` : ""}</div>` +
  `<p class="mt-1 text-sm text-muted-foreground">${esc(p.description)}</p>` +
  `<p class="mt-4 flex items-baseline gap-1"><span class="font-display font-extrabold text-4xl text-foreground">${esc(p.price)}</span><span class="text-sm text-muted-foreground">${esc(p.period)}</span></p>` +
  `<ul class="mt-5 flex flex-col gap-2.5">` +
  p.features.map((f) => `<li class="flex items-start gap-2 text-sm text-foreground"><span class="text-primary">✓</span><span>${esc(f)}</span></li>`).join("") +
  `</ul></div>`;

const pricingBody = (campaign) =>
  `<main>` +
  hero(
    "Planes y precios",
    "Empieza gratis y sube de plan cuando tu negocio lo necesite. Sin contratos, sin permanencia mínima y con la opción de pagar mensual, trimestral o anual con descuento.",
    campaign,
    "Empezar gratis"
  ) +
  `<section class="py-12"><div class="container mx-auto px-4 max-w-6xl">` +
  `<h2 class="font-display font-bold text-2xl md:text-3xl text-foreground text-center">El plan perfecto para tu negocio</h2>` +
  `<p class="mt-3 text-center text-muted-foreground max-w-2xl mx-auto">Elige el plan que mejor se adapte y escala cuando lo necesites. Cada plan incluye créditos de IA mensuales y no cobramos comisión por venta.</p>` +
  `<div class="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch">${PLANS.map(planCard).join("")}</div>` +
  `<p class="mt-6 text-center text-sm text-muted-foreground">Trimestral: 10% de descuento · Anual: 50% de descuento. Catálogo adicional $4.99/mes.</p>` +
  `</div></section>` +
  faqSection(HOME_FAQS) +
  closingCta(campaign) +
  `</main>`;

// /features — Funciones (HowItWorks + Features + AiFeatures).
const FEATURE_STEPS = [
  { title: "Crea tu catálogo", text: "Sube tus productos y personalízalo con tu logo, colores y tu propio enlace." },
  { title: "Comparte tu link", text: "Publica tu tienda en tus redes. Tus clientes la abren y arman su pedido solos." },
  { title: "Recibe y atiende", text: "La orden te llega a tu WhatsApp y a tu panel, y atiendes a tu cliente en un solo lugar." },
];

const FEATURE_BLOCKS = [
  {
    title: "Tu tienda online, lista para vender",
    text: "Tu cliente navega, elige y arma su pedido solo — como en un ecommerce real, sin el costo ni la complejidad. Personaliza colores, logo y tu propio enlace, con categorías y buscador para encontrar todo rápido.",
  },
  {
    title: "Recibe pedidos completos por WhatsApp",
    text: "Cuando el cliente confirma, te llega el pedido entero: productos, cantidades y datos. Todo en tu panel y en tu WhatsApp, con notificaciones al instante e historial de cada pedido. Nada de anotar a mano.",
  },
  {
    title: "Precios en dos monedas con tasa del día",
    text: "Cargas tus precios en dólares y cada cliente ve el monto en su moneda con la tasa del día (BCV) actualizada sola. Sin cálculos manuales ni editar producto por producto.",
  },
  {
    title: "Cada venta es 100% tuya",
    text: "No te cobramos comisión por tus pedidos: pagas tu plan mensual y listo. Pedidos ilimitados en tu WhatsApp, sin sorpresas en tu factura.",
  },
];

const AI_ITEMS = [
  { title: "Genera imágenes con IA", text: "Crea fotos de producto profesionales a partir de un texto." },
  { title: "Quita el fondo con IA", text: "Deja tus fotos con un fondo limpio y uniforme en un clic." },
  { title: "Borrador a mano", text: "Borra lo que sobra de la imagen pasando el cursor, estilo Canva." },
  { title: "Mejora la descripción con IA", text: "Convierte una descripción simple en un texto claro y vendedor." },
];

const featuresBody = (campaign) =>
  `<main>` +
  hero(
    "Funciones de CatalogoHoy",
    "Todas las herramientas para mostrar tus productos, recibir pedidos por WhatsApp y hacer crecer tu negocio desde un solo lugar.",
    campaign,
    "Crea tu catálogo gratis"
  ) +
  prose("De tu catálogo a tus clientes, todo en un mismo lugar", [
    "Tu cliente entra a tu tienda y hace su pedido. La orden te llega a WhatsApp y atiendes desde todos tus canales (WhatsApp, Instagram, Facebook y TikTok), sin cambiar de app.",
  ]) +
  stepsSection("Cómo funciona, en 3 pasos", FEATURE_STEPS) +
  cardsSection("Todo lo que tu tienda necesita, desde el primer día", FEATURE_BLOCKS) +
  cardsSection(
    "Inteligencia artificial en el editor",
    AI_ITEMS,
    "La IA integrada te ayuda a tener un catálogo profesional sin diseñador ni redactor. Cada plan incluye créditos de IA mensuales."
  ) +
  closingCta(campaign) +
  `</main>`;

// /faq — usa los FAQ reales cargados desde src/data/faqs.ts.
const faqPageBody = (campaign) =>
  `<main>` +
  hero(
    "Preguntas frecuentes",
    "Todo lo que necesitas saber antes de crear tu catálogo digital con CatalogoHoy. ¿No encuentras tu respuesta? Escríbenos y te ayudamos.",
    campaign,
    "Crear mi catálogo gratis"
  ) +
  faqSection(HOME_FAQS) +
  closingCta(campaign) +
  `</main>`;

// ---- 6. Las 8 páginas ------------------------------------------------------
const PAGES = [];

// /pricing
PAGES.push({
  urlPath: "/pricing",
  title: "Precios y planes de catálogo digital | CatalogoHoy",
  description:
    "Planes de CatalogoHoy: empieza gratis y crece con Básico ($11.99), Pro ($19.99) y Avanzado ($29.99). Sin permanencia. Catálogo digital y pedidos por WhatsApp.",
  body: pricingBody("pricing"),
  jsonLd: [
    webPageLd("Planes y precios — CatalogoHoy", "Planes de CatalogoHoy: gratis, Básico, Pro y Avanzado.", `${BASE_URL}/pricing`),
    breadcrumbLd("Precios", `${BASE_URL}/pricing`),
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: "CatalogoHoy",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: BASE_URL,
      description: "Crea tu catálogo digital, comparte tus productos por WhatsApp y recibe órdenes online.",
      offers: PRICING_OFFERS.map((o) => ({
        "@type": "Offer",
        name: o.name,
        description: o.description,
        price: o.price,
        priceCurrency: "USD",
      })),
    },
  ],
});

// /features
PAGES.push({
  urlPath: "/features",
  title: "Funciones: catálogo, WhatsApp e IA | CatalogoHoy",
  description:
    "Todo lo que puedes hacer con CatalogoHoy: catálogo personalizable, pedidos por WhatsApp, gestión de órdenes, precios en dos monedas e IA para tus fotos.",
  body: featuresBody("features"),
  jsonLd: [
    webPageLd(
      "Funciones de CatalogoHoy",
      "Catálogo digital personalizable, pedidos por WhatsApp, gestión de órdenes e IA.",
      `${BASE_URL}/features`
    ),
    breadcrumbLd("Funciones", `${BASE_URL}/features`),
  ],
});

// /faq
PAGES.push({
  urlPath: "/faq",
  title: "Preguntas frecuentes | CatalogoHoy",
  description:
    "Respuestas a las dudas más comunes sobre CatalogoHoy: cómo crear tu catálogo digital gratis, compartirlo por WhatsApp, recibir órdenes, cambiar de plan y más.",
  body: faqPageBody("faq"),
  jsonLd: [
    webPageLd(
      "Preguntas frecuentes — CatalogoHoy",
      "Respuestas a las dudas más comunes sobre CatalogoHoy.",
      `${BASE_URL}/faq`
    ),
    breadcrumbLd("Preguntas frecuentes", `${BASE_URL}/faq`),
    faqLd(HOME_FAQS),
  ],
});

// ─── Las 4 guías SEO (misma estructura) ─────────────────────────────────────
const GUIDES = [
  {
    urlPath: "/catalogo-por-whatsapp",
    breadcrumb: "Catálogo por WhatsApp",
    title: "Catálogo por WhatsApp gratis | CatalogoHoy",
    description:
      "Crea un catálogo digital para vender por WhatsApp: sube tus productos, comparte un enlace y recibe pedidos directo en tu chat. Gratis, sin tarjeta. Empieza hoy.",
    h1: "Catálogo por WhatsApp: crea el tuyo y vende sin fricción",
    subtitle:
      "Arma tu catálogo digital, compártelo con un enlace y recibe los pedidos directo en tu WhatsApp. Empieza gratis, sin tarjeta de crédito.",
    ctaLabel: "Crear mi catálogo gratis",
    contextH2: "¿Qué es un catálogo por WhatsApp?",
    contextParagraphs: [
      "Un catálogo por WhatsApp es tu vitrina digital: una página con todos tus productos (fotos, precios y variantes) que compartes con un solo enlace. Tus clientes lo abren desde el chat, arman su pedido y este te llega a tu WhatsApp listo para confirmar. Es la forma más simple de vender online sin montar una tienda complicada ni depender de un PDF que nadie termina de abrir.",
      "Con CatalogoHoy creas ese catálogo en minutos, lo personalizas con tu marca y lo mantienes siempre actualizado. Ideal para negocios que ya venden por WhatsApp y quieren verse más profesionales y ordenar sus pedidos.",
    ],
    stepsH2: "Cómo crear tu catálogo por WhatsApp en 4 pasos",
    steps: [
      { title: "Crea tu cuenta gratis", text: "Regístrate en menos de un minuto, sin tarjeta. Creas tu primer catálogo al instante." },
      { title: "Sube tus productos", text: "Fotos, precios, variantes y descripciones. Importa desde Excel o PDF si ya los tienes." },
      { title: "Comparte tu enlace", text: "Personaliza el diseño y comparte el enlace único de tu catálogo por WhatsApp o donde vendas." },
      { title: "Recibe pedidos", text: "El cliente arma su pedido y te llega directo a tu WhatsApp para cerrar la venta." },
    ],
    benefitsH2: "Por qué vender con un catálogo por WhatsApp",
    benefits: [
      { title: "Vende donde ya están tus clientes", text: "El 90% de las ventas de pequeños negocios en Latinoamérica pasan por WhatsApp. Tu catálogo vive justo ahí." },
      { title: "Se ve profesional, no un PDF pesado", text: "Un enlace que carga al instante, con buscador, categorías y fotos ordenadas. Nada de archivos que nadie abre." },
      { title: "Pedidos ordenados, sin errores", text: "El cliente elige cantidades y variantes; el pedido te llega claro y calculado, listo para confirmar." },
      { title: "Actualízalo cuando quieras", text: "Cambias un precio o agregas stock y el enlace se actualiza solo. Sin reenviar nada." },
    ],
    niches: {
      h2: "Perfecto para tu tipo de negocio",
      intro: "Miles de negocios usan su catálogo por WhatsApp todos los días:",
      items: ["tiendas de ropa", "zapaterías", "cosméticos y belleza", "comida y restaurantes", "accesorios y joyería", "productos por catálogo"],
    },
    faqs: [
      { q: "¿Cómo hago un catálogo para vender por WhatsApp?", a: "Crea tu catálogo digital gratis en CatalogoHoy, sube tus productos con foto y precio, y comparte el enlace por WhatsApp. Tus clientes eligen lo que quieren y el pedido te llega a tu WhatsApp." },
      { q: "¿Es gratis el catálogo por WhatsApp?", a: "Sí. El plan gratuito incluye hasta 10 productos y un catálogo, sin tarjeta de crédito. Puedes ampliar cuando tu negocio crezca." },
      { q: "¿Los pedidos llegan directo a mi WhatsApp?", a: "Sí. Cuando un cliente termina su pedido en el catálogo, se genera un mensaje con el detalle que llega a tu número de WhatsApp para que confirmes y coordines el pago y la entrega." },
    ],
    howToName: "Cómo crear un catálogo por WhatsApp",
    howToDescription: "Crea un catálogo digital y compártelo por WhatsApp para recibir pedidos, en 4 pasos.",
  },
  {
    urlPath: "/catalogo-digital",
    breadcrumb: "Catálogo digital",
    title: "Catálogo digital: qué es y cómo crearlo | CatalogoHoy",
    description:
      "Descubre qué es un catálogo digital, sus ventajas frente al PDF o el catálogo físico, y cómo crear el tuyo gratis en minutos para vender online y por WhatsApp.",
    h1: "Catálogo digital: qué es y cómo crear el tuyo gratis",
    subtitle:
      "Aprende qué es un catálogo digital, por qué le gana al PDF y al catálogo impreso, y cómo armar el tuyo en minutos para vender online y por WhatsApp. Gratis, sin tarjeta de crédito.",
    ctaLabel: "Crear mi catálogo gratis",
    contextH2: "¿Qué es un catálogo digital?",
    contextParagraphs: [
      "Un catálogo digital es la versión online de tu catálogo de productos: una página con fotos, precios, variantes y categorías que vive en un enlace y compartes con quien quieras. En lugar de un archivo que tu cliente descarga, es una vitrina que se abre al instante desde cualquier teléfono, con buscador y todo ordenado.",
      "La gran diferencia con un PDF o un catálogo impreso es que está vivo: cambias un precio, agregas un producto o se agota el stock, y el enlace refleja el cambio solo. Además, tus clientes no solo miran: pueden armar su pedido ahí mismo y enviártelo. Es la forma más simple de vender online sin montar una tienda compleja.",
    ],
    stepsH2: "Cómo crear tu catálogo digital en 4 pasos",
    steps: [
      { title: "Crea tu cuenta gratis", text: "Regístrate en menos de un minuto, sin tarjeta. Creas tu primer catálogo digital al instante." },
      { title: "Sube tus productos", text: "Fotos, precios, variantes y descripciones. Importa desde Excel o PDF si ya los tienes." },
      { title: "Organiza en categorías", text: "Agrupa tus productos por categorías para que se encuentren rápido con el buscador." },
      { title: "Comparte tu enlace", text: "Personaliza el diseño y comparte el enlace único de tu catálogo por WhatsApp o donde vendas." },
    ],
    benefitsH2: "Ventajas frente al PDF y al catálogo físico",
    benefitsIntro: "El PDF y el impreso quedan desactualizados apenas cambias algo. Un catálogo digital resuelve justo eso:",
    benefits: [
      { title: "Siempre actualizado", text: "Cambias un precio o agregas stock y el enlace se actualiza solo. Sin rehacer archivos ni reenviar nada." },
      { title: "Se comparte con un link", text: "Un solo enlace que abres en WhatsApp, Instagram o donde vendas. Carga al instante, sin descargas." },
      { title: "Buscador y categorías", text: "Tus clientes filtran por categoría y encuentran lo que buscan en segundos, no scrolleando un PDF eterno." },
      { title: "Carga rápida y ligera", text: "Nada de archivos pesados que nadie termina de abrir. Tu catálogo se ve bien en cualquier teléfono." },
      { title: "Pedidos ordenados", text: "El cliente elige cantidades y variantes; el pedido te llega claro y calculado, listo para confirmar." },
      { title: "Con la cara de tu marca", text: "Colores, logo y datos de tu negocio. Se ve profesional, no un documento genérico." },
    ],
    niches: {
      h2: "Para qué negocios sirve",
      intro: "Cualquier negocio con productos puede tener su catálogo digital. Estos son algunos que ya lo usan todos los días:",
      items: ["tiendas de ropa", "zapaterías", "cosméticos y belleza", "comida y restaurantes", "accesorios y joyería", "productos por catálogo"],
    },
    faqs: [
      { q: "¿Qué es un catálogo digital?", a: "Es una versión online de tu catálogo de productos: una página con fotos, precios, variantes y categorías que compartes con un enlace. A diferencia de un PDF o un catálogo impreso, se actualiza al instante y tus clientes pueden armar su pedido desde ahí." },
      { q: "¿Cómo hago un catálogo digital gratis?", a: "Crea tu cuenta gratis en CatalogoHoy, sube tus productos con foto y precio, organiza tus categorías y comparte tu enlace. No necesitas tarjeta de crédito ni conocimientos técnicos." },
      { q: "¿En qué se diferencia de un catálogo en PDF?", a: "El PDF es un archivo estático y pesado: cada cambio te obliga a rehacerlo y reenviarlo. Un catálogo digital vive en un enlace que carga al instante, tiene buscador y categorías, y se actualiza solo cuando cambias un precio o agregas un producto." },
      { q: "¿Puedo recibir pedidos desde mi catálogo digital?", a: "Sí. Tus clientes eligen productos, cantidades y variantes, y el pedido te llega ordenado directo a tu WhatsApp para que confirmes el pago y la entrega." },
      { q: "¿Necesito una página web para tener un catálogo digital?", a: "No. Tu catálogo digital ya es una página lista para compartir con su propio enlace. Puedes ponerlo en la biografía de tus redes, en tu estado de WhatsApp o donde vendas." },
    ],
    howToName: "Cómo crear un catálogo digital",
    howToDescription: "Crea tu catálogo digital gratis, súbelo con tus productos y compártelo con un enlace, en 4 pasos.",
  },
  {
    urlPath: "/crear-catalogo-online-gratis",
    breadcrumb: "Crear catálogo online gratis",
    title: "Crear catálogo online gratis | CatalogoHoy",
    description:
      "Crea tu catálogo online gratis, sin tarjeta de crédito: sube tus productos, personaliza el diseño y compártelo por WhatsApp. Empieza en minutos.",
    h1: "Crea tu catálogo online gratis en minutos",
    subtitle:
      "Sube tus productos, personaliza el diseño y comparte tu enlace por WhatsApp. Sin tarjeta de crédito y sin complicaciones: empiezas hoy mismo.",
    ctaLabel: "Crear mi catálogo gratis",
    contextH2: "Crea tu catálogo gratis, sin tarjeta",
    contextParagraphs: [
      "No necesitas invertir nada para empezar a vender online. El plan gratuito de CatalogoHoy te deja publicar hasta 10 productos en un catálogo, con tu enlace único para compartir y pedidos que llegan directo a tu WhatsApp. Sin tarjeta de crédito, sin período de prueba que caduca y sin letra chica: creas la cuenta y en minutos tienes una vitrina lista para enviar a tus clientes.",
      "Es la forma más rápida de dejar de mandar fotos sueltas o un catálogo digital improvisado y pasar a algo que se ve profesional. Todo lo que cargues es tuyo: si más adelante decides crecer, amplías el límite sin volver a empezar.",
    ],
    stepsH2: "En 4 pasos y en minutos",
    steps: [
      { title: "Regístrate gratis", text: "Crea tu cuenta con tu correo en menos de un minuto. Sin tarjeta, sin prueba que caduca." },
      { title: "Sube tus productos", text: "Hasta 10 productos gratis con foto, precio y descripción. Importa desde Excel o PDF si ya los tienes." },
      { title: "Personaliza el diseño", text: "Ajusta colores, logo y el orden de tus productos para que el catálogo tenga tu marca." },
      { title: "Comparte tu enlace", text: "Copia tu enlace único y compártelo por WhatsApp o redes. Los pedidos te llegan directo al chat." },
    ],
    benefitsH2: "Qué puedes hacer con el plan gratis",
    benefitsIntro: "El plan gratuito no es una demo recortada: alcanza para vender de verdad desde el primer día.",
    benefits: [
      { title: "Un enlace listo para compartir", text: "Tu catálogo vive en una página que carga al instante. Sin apps que instalar ni PDF pesados que nadie abre." },
      { title: "Pedidos por WhatsApp", text: "El cliente arma su pedido y te llega a tu WhatsApp con el detalle calculado, listo para confirmar." },
      { title: "Fotos, precios y variantes", text: "Muestra cada producto con su foto, precio y opciones (talla, color) para que se vea profesional." },
      { title: "Actualízalo cuando quieras", text: "Cambias un precio o agregas stock y el enlace se actualiza solo. No tienes que reenviar nada." },
    ],
    niches: {
      h2: "Errores comunes al crear tu primer catálogo",
      intro: "Evítalos desde el inicio y tu catálogo venderá más sin esfuerzo extra:",
      items: ["fotos claras y con buena luz", "usa categorías", "precios al día", "descripciones útiles"],
    },
    faqs: [
      { q: "¿De verdad es gratis crear un catálogo online?", a: "Sí. Puedes crear tu catálogo online gratis, sin tarjeta de crédito y sin período de prueba que caduca. El plan gratuito incluye hasta 10 productos, un catálogo y tu enlace para compartir por WhatsApp." },
      { q: "¿Necesito tarjeta de crédito para empezar?", a: "No. Te registras con tu correo, subes tus productos y compartes el enlace. Solo dejas datos de pago si más adelante decides pasar a un plan con más productos o funciones." },
      { q: "¿Cuánto tarda en estar listo mi catálogo?", a: "Minutos. Creas la cuenta, subes tus primeros productos con foto y precio, personalizas el diseño y ya tienes un enlace listo para enviar a tus clientes. No necesitas conocimientos técnicos." },
      { q: "¿Puedo agregar más productos después?", a: "Sí. Empiezas con hasta 10 productos gratis y, cuando tu negocio crezca, puedes ampliar el límite pasando a un plan pago sin perder lo que ya cargaste." },
    ],
    howToName: "Cómo crear un catálogo online gratis",
    howToDescription: "Crea tu catálogo online gratis, sube tus productos y compártelo por WhatsApp, en 4 pasos.",
  },
  {
    urlPath: "/catalogo-para-tiendas-de-ropa",
    breadcrumb: "Catálogo para tiendas de ropa",
    title: "Catálogo digital para tiendas de ropa | CatalogoHoy",
    description:
      "Crea el catálogo digital de tu tienda de ropa: muestra tus prendas con fotos, tallas y colores, y recibe pedidos por WhatsApp. Gratis para empezar.",
    h1: "Catálogo digital para tu tienda de ropa",
    subtitle:
      "Muestra tus prendas con fotos, tallas y colores, organiza tus colecciones y recibe los pedidos directo en tu WhatsApp. Empieza gratis, sin tarjeta de crédito.",
    ctaLabel: "Crear mi catálogo de ropa gratis",
    contextH2: "El catálogo que tu tienda de ropa necesita",
    contextParagraphs: [
      "En el mundo de la moda todo cambia rápido: llegan colecciones nuevas, cambian las temporadas y cada semana tienes prendas que destacar. Un grupo de fotos sueltas por WhatsApp o un PDF pesado ya no alcanza para verse profesional ni para que tus clientes encuentren lo que buscan. Tu tienda de ropa necesita una vitrina digital ordenada, siempre actualizada y fácil de compartir.",
      "Con CatalogoHoy creas el catálogo online de tu tienda de ropa en minutos: subes tus prendas con fotos, precios, tallas y colores, y las organizas por categoría o colección. Compartes un solo enlace por WhatsApp e Instagram, donde ya están tus clientes, y ellos arman su pedido eligiendo la talla y el color exactos. El pedido te llega a tu chat, listo para confirmar el pago y coordinar el envío.",
    ],
    stepsH2: "Cómo armar tu catálogo de ropa en 4 pasos",
    steps: [
      { title: "Crea tu cuenta gratis", text: "Regístrate en menos de un minuto, sin tarjeta. Creas el catálogo de tu tienda de ropa al instante." },
      { title: "Sube tus prendas con fotos", text: "Foto, precio y descripción por prenda. Importa desde Excel si ya tienes tu lista de productos." },
      { title: "Configura tallas y colores", text: "Agrega variantes de talla y color, cada una con su foto y precio, e indica el stock disponible." },
      { title: "Comparte y recibe pedidos", text: "Comparte tu enlace por WhatsApp e Instagram. El cliente elige talla y color y el pedido te llega al chat." },
    ],
    benefitsH2: "Funciones clave para moda",
    benefits: [
      { title: "Galería de fotos por prenda", text: "Sube varias fotos por prenda para mostrar detalles, texturas y cómo se ve puesta. Tus clientes compran con más confianza cuando ven bien lo que ofreces." },
      { title: "Categorías por tipo de prenda", text: "Organiza tu ropa en categorías: blusas, jeans, vestidos, abrigos, calzado o por temporada. Tu cliente encuentra rápido lo que busca." },
      { title: "Precios y ofertas", text: "Muestra el precio de cada prenda y aplica descuentos o rebajas de temporada. Ideal para liquidar colecciones anteriores y destacar tus novedades." },
      { title: "Pedidos por WhatsApp", text: "Cada pedido llega a tu WhatsApp con la prenda, la talla y el color elegidos. Confirmas el pago y coordinas el envío sin idas y vueltas." },
    ],
    niches: {
      h2: "Ideal para",
      intro: "Cualquier tienda de ropa puede vender más con su catálogo digital:",
      items: ["boutiques", "ropa femenina", "ropa masculina", "ropa urbana", "ropa infantil", "calzado"],
    },
    faqs: [
      { q: "¿Puedo poner tallas y colores en mi catálogo de ropa?", a: "Sí. Cada prenda puede tener sus variantes de talla (S, M, L, XL o numéricas) y de color, cada una con su propia foto y precio. Tu cliente elige la combinación exacta que quiere antes de hacer el pedido." },
      { q: "¿Puedo manejar el stock por talla?", a: "Sí. Puedes indicar la disponibilidad de cada variante para que tus clientes solo pidan lo que tienes. Así evitas vender una talla agotada y coordinar cambios después." },
      { q: "¿Sirve para vender ropa por WhatsApp e Instagram?", a: "Totalmente. Compartes el enlace de tu catálogo en tu bio de Instagram, en tus historias o directamente por WhatsApp, y los pedidos te llegan a tu chat listos para confirmar el pago y el envío." },
      { q: "¿Puedo organizar mi ropa por temporada o colección?", a: "Sí. Creas categorías por tipo de prenda, temporada o colección (por ejemplo, verano, nueva temporada o rebajas) para que tus clientes encuentren rápido lo que buscan." },
      { q: "¿Es gratis para una tienda de ropa que recién empieza?", a: "Sí. El plan gratuito te permite empezar a subir prendas y compartir tu catálogo sin tarjeta de crédito. Cuando tu tienda crezca, puedes ampliar el número de productos y variantes." },
    ],
    howToName: "Cómo crear el catálogo de tu tienda de ropa",
    howToDescription: "Crea el catálogo digital de tu tienda de ropa con tallas, colores y fotos, y recibe pedidos por WhatsApp, en 4 pasos.",
  },
  {
    urlPath: "/menu-digital-para-restaurantes",
    breadcrumb: "Menú digital para restaurantes",
    title: "Menú digital para restaurantes | CatalogoHoy",
    description:
      "Crea el menú digital de tu restaurante: platos con fotos y precios, pedidos por WhatsApp y actualización al instante. Gratis para empezar.",
    h1: "Menú digital para tu restaurante",
    subtitle:
      "Cambia la carta en papel por un menú digital con fotos y precios. Compártelo con un enlace, recibe pedidos por WhatsApp y actualízalo al instante. Empieza gratis, sin tarjeta de crédito.",
    ctaLabel: "Crear mi menú digital gratis",
    contextH2: "El menú digital que tu restaurante necesita",
    contextParagraphs: [
      "La carta en papel se ensucia, se desactualiza y cuesta reimprimir cada vez que cambia un precio. El PDF que mandas por WhatsApp pesa, tarda en abrir y termina siendo un archivo que nadie mira. Un menú digital resuelve las dos cosas: es una página que carga al instante, con tus platos ordenados por categoría, fotos, precios y descripciones, y que compartes con un solo enlace.",
      "Con CatalogoHoy creas el menú digital de tu restaurante en minutos y lo tienes siempre al día. Tus clientes lo abren desde el chat, arman su pedido con adicionales y este te llega directo a tu WhatsApp para coordinar delivery, retiro o consumo en el local. Es la forma más simple de vender comida online sin pagar comisiones a una app de delivery ni montar una tienda complicada.",
    ],
    stepsH2: "Cómo crear tu menú digital en 4 pasos",
    steps: [
      { title: "Crea tu cuenta gratis", text: "Regístrate en menos de un minuto, sin tarjeta. Creas el menú digital de tu restaurante al instante." },
      { title: "Carga tus platos y categorías", text: "Ordena el menú en entradas, platos fuertes, postres y bebidas. Suma fotos, precios, descripciones y adicionales." },
      { title: "Comparte tu enlace", text: "Personaliza el diseño con tu marca y comparte el enlace por WhatsApp, Instagram o con un código QR en las mesas." },
      { title: "Recibe pedidos", text: "El cliente arma su pedido con adicionales y te llega directo a tu WhatsApp para confirmar y coordinar el delivery." },
    ],
    benefitsH2: "Funciones clave para gastronomía",
    benefits: [
      { title: "Actualización al instante", text: "Cambias un precio o marcas un plato como agotado y el menú se actualiza solo. Nunca vendes lo que hoy no tienes." },
      { title: "Pedidos por WhatsApp", text: "El cliente elige platos y adicionales; el pedido te llega claro y calculado a tu WhatsApp, listo para preparar y enviar." },
      { title: "Sin comisiones por pedido", text: "A diferencia de las apps de delivery, no te cobramos un porcentaje por cada venta. El precio de tu plato es tuyo." },
      { title: "Fotos que dan hambre", text: "Un menú visual con fotos ordenadas por categoría vende más que una carta en texto o un PDF que nadie termina de abrir." },
    ],
    niches: {
      h2: "Ideal para",
      intro: "Todo tipo de negocio gastronómico usa su menú digital para vender más y ordenar sus pedidos:",
      items: ["restaurantes", "cafeterías", "food trucks", "dark kitchens", "panaderías", "delivery"],
    },
    faqs: [
      { q: "¿Puedo agregar adicionales o extras a cada plato?", a: "Sí. A cada plato le sumas adicionales y extras opcionales: extra de queso, salsas, guarniciones, tamaño de la bebida o punto de cocción. El cliente los elige y el precio se calcula solo, sin que tengas que aclarar nada por chat." },
      { q: "¿Actualizo los precios y la disponibilidad al instante?", a: "Sí. Cambias el precio de un plato o marcas algo como agotado y tu menú digital se actualiza al instante para todos. No reimprimes cartas ni reenvías PDF: el enlace siempre muestra lo que hoy tienes disponible." },
      { q: "¿Sirve para delivery y para pedidos por WhatsApp?", a: "Sí. Tu menú digital está pensado para delivery y para llevar. El cliente arma su pedido, elige adicionales y lo confirma; el detalle te llega directo a tu WhatsApp para que coordines pago y entrega, sin comisiones por pedido." },
    ],
    howToName: "Cómo crear el menú digital de tu restaurante",
    howToDescription: "Crea el menú digital de tu restaurante y compártelo por WhatsApp para recibir pedidos, en 4 pasos.",
  },
];

for (const g of GUIDES) {
  PAGES.push({
    urlPath: g.urlPath,
    title: g.title,
    description: g.description,
    body: guideBody({ ...g, campaign: g.urlPath.replace(/^\//, "") }),
    jsonLd: [
      webPageLd(g.h1, g.description, BASE_URL + g.urlPath),
      breadcrumbLd(g.breadcrumb, BASE_URL + g.urlPath),
      howToLd(g.howToName, g.howToDescription, g.steps),
      faqLd(g.faqs),
    ],
  });
}

// ---- 7. Generar ------------------------------------------------------------
for (const p of PAGES) {
  await writePage(
    p.urlPath,
    buildPage(template, {
      title: p.title,
      description: p.description,
      urlPath: p.urlPath,
      ogImage: DEFAULT_OG,
      ogType: "website",
      jsonLd: p.jsonLd,
      body: p.body,
    })
  );
}

console.log(`[prerender-pages] ${PAGES.length} páginas de marketing estáticas generadas en dist/`);
