import { Head } from "vite-react-ssg";

export const SITE_URL = "https://help.catalogohoy.com";
export const SITE_NAME = "Centro de ayuda | Catálogo Hoy";
const DEFAULT_DESC =
  "Guías y respuestas para sacarle el máximo a tu catálogo: productos, pedidos, tasas del día, pagos, envíos, notificaciones por WhatsApp y más.";
const OG_IMAGE = "https://catalogohoy.com/og-image.png";

export interface SeoProps {
  title: string;
  description?: string;
  /** Path starting with "/" (used for canonical + og:url). */
  path: string;
  /** "website" | "article". */
  type?: string;
  /** One or more JSON-LD objects injected as <script type="application/ld+json">. */
  jsonLd?: object | object[];
  /** Keep search/utility pages out of the index. */
  noindex?: boolean;
}

/**
 * Per-page SEO head. With vite-react-ssg these tags are baked into the static
 * HTML at build time, so Google indexes each guide directly (no JS render).
 */
export const Seo = ({
  title,
  description = DEFAULT_DESC,
  path,
  type = "website",
  jsonLd,
  noindex = false,
}: SeoProps) => {
  const url = SITE_URL + path;
  const fullTitle =
    title === SITE_NAME ? title : `${title} | Centro de ayuda`;
  const blocks = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta
        name="robots"
        content={noindex ? "noindex, follow" : "index, follow, max-image-preview:large"}
      />

      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Catálogo Hoy" />
      <meta property="og:locale" content="es_ES" />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={OG_IMAGE} />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={OG_IMAGE} />

      {blocks.map((b, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(b)}
        </script>
      ))}
    </Head>
  );
};

/** Organization node reused across pages. */
export const orgJsonLd = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Catálogo Hoy",
  url: "https://catalogohoy.com",
  logo: "https://catalogohoy.com/favicon.png",
};

export const breadcrumbJsonLd = (
  items: { name: string; path: string }[]
) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: items.map((it, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: it.name,
    item: SITE_URL + it.path,
  })),
});
