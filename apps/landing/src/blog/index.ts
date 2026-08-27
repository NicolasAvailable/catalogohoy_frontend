import type { BlogArticle, BlogCategory } from "./types";
import { comoVenderPorWhatsapp2026 } from "./articles/como-vender-por-whatsapp-guia-2026";
import { comoCrearCatalogoDigital2026 } from "./articles/como-crear-un-catalogo-digital-gratis-2026";
import { catalogoPdfVsOnline2026 } from "./articles/catalogo-pdf-vs-catalogo-online-2026";

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
];

/** Ordenados del más nuevo al más viejo (el índice los muestra en este orden). */
export const ARTICLES: BlogArticle[] = [
  comoVenderPorWhatsapp2026,
  comoCrearCatalogoDigital2026,
  catalogoPdfVsOnline2026,
].sort((a, b) => (a.date < b.date ? 1 : -1));

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
