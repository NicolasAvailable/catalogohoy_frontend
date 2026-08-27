import type { BlogArticle, BlogCategory } from "./types";
import { comoVenderPorWhatsapp2026 } from "./articles/como-vender-por-whatsapp-guia-2026";
import { comoCrearCatalogoDigital2026 } from "./articles/como-crear-un-catalogo-digital-gratis-2026";
import { catalogoPdfVsOnline2026 } from "./articles/catalogo-pdf-vs-catalogo-online-2026";
import { comoMejorarLasVentas2026 } from "./articles/como-mejorar-las-ventas-2026";
import { comoCobrarPorWhatsapp2026 } from "./articles/como-cobrar-por-whatsapp-2026";
import { COUNTRY_ARTICLES } from "./articles/paises";

export const CATEGORIES: BlogCategory[] = [
  {
    slug: "ventas-por-whatsapp",
    name: "Ventas por WhatsApp",
    description:
      "Guías prácticas para vender más por WhatsApp: atención, pedidos y cierres.",
  },
  {
    slug: "catalogo-digital",
    name: "Catálogo digital",
    description:
      "Cómo crear, organizar y sacarle provecho a tu catálogo de productos online.",
  },
  {
    slug: "emprender",
    name: "Emprender",
    description:
      "Estrategias de ventas, precios y crecimiento para tu negocio.",
  },
  {
    slug: "por-pais",
    name: "Guías por país",
    description:
      "Cómo crear tu catálogo y vender online en cada país de Latinoamérica.",
  },
];

/** Registro editorial: a igual fecha manda este orden (el primero es el destacado). */
const REGISTRY: BlogArticle[] = [
  comoMejorarLasVentas2026,
  comoCobrarPorWhatsapp2026,
  comoVenderPorWhatsapp2026,
  comoCrearCatalogoDigital2026,
  catalogoPdfVsOnline2026,
  ...COUNTRY_ARTICLES,
];

/** Ordenados del más nuevo al más viejo, con desempate estable por el registro. */
export const ARTICLES: BlogArticle[] = REGISTRY.map(
  (article, i) => [article, i] as const
)
  .sort(([a, i], [b, j]) => (a.date !== b.date ? (a.date < b.date ? 1 : -1) : i - j))
  .map(([article]) => article);

export const categoryBySlug = (slug: string): BlogCategory | undefined =>
  CATEGORIES.find((c) => c.slug === slug);

export const articlesByCategory = (slug: string): BlogArticle[] =>
  ARTICLES.filter((a) => a.category === slug);

export const findArticle = (
  category: string,
  slug: string
): BlogArticle | undefined =>
  ARTICLES.find((a) => a.category === category && a.slug === slug);

/** Relacionados: misma categoría primero, luego el resto (sin el actual). */
export const relatedArticles = (article: BlogArticle, max = 3): BlogArticle[] => [
  ...ARTICLES.filter((a) => a.slug !== article.slug && a.category === article.category),
  ...ARTICLES.filter((a) => a.slug !== article.slug && a.category !== article.category),
].slice(0, max);

/** URL de registro con atribución del artículo (para medir qué contenido convierte). */
export const signupUrl = (campaign: string): string =>
  `https://auth.catalogohoy.com/signup?utm_source=blog&utm_medium=cta&utm_campaign=${campaign}`;
