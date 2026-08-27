/**
 * Blog de captación SEO — formato estilo vacantes.com: guías largas por
 * keyword con puntos clave, tabla de contenidos, tablas comparativas, CTAs
 * embebidos y FAQ. Los artículos se escriben como datos tipados (bloques),
 * NO como markdown: el renderer garantiza el mismo formato/estilo en todos
 * y genera el JSON-LD (Article + FAQPage + Breadcrumb) automáticamente.
 */

export type ArticleBlock =
  /** Párrafo. Admite HTML inline propio (<strong>, <a>, <em>) — contenido
   *  nuestro, nunca input de usuarios. */
  | { type: "p"; html: string }
  /** Sección H2 — entra a la tabla de contenidos; `id` es el ancla. */
  | { type: "h2"; id: string; text: string }
  | { type: "h3"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  /** CTA embebido en el cuerpo (además del CTA global del final). */
  | { type: "cta"; title: string; text: string; button: string }
  | { type: "quote"; text: string };

export interface BlogFaq {
  q: string;
  a: string;
}

export interface BlogArticle {
  /** Slug de la URL: /blog/{category}/{slug} — incluir keyword y año. */
  slug: string;
  /** Slug de la categoría (debe existir en CATEGORIES). */
  category: string;
  /** H1 del artículo. */
  title: string;
  metaTitle: string;
  metaDescription: string;
  /** Resumen para las cards del índice (~150 chars). */
  excerpt: string;
  author: string;
  /** ISO yyyy-mm-dd. */
  date: string;
  /** Título CORTO para la portada (2-6 palabras; se parte en dos tonos por
   *  `coverAccent`). Si falta, se usa `title`. */
  coverTitle?: string;
  /** Palabra(s) del coverTitle a resaltar en tono claro (estilo vacantes). */
  coverAccent?: string;
  /** Chip pequeño bajo el título de la portada, ej. "Guía paso a paso 2026". */
  coverTagline?: string;
  /** Foto opcional para el lado izquierdo de la portada (ruta en /public).
   *  Sin foto, se usa un patrón decorativo — la portada se genera por CSS. */
  coverImage?: string;
  readMinutes: number;
  /** "Puntos clave" — resumen en bullets al inicio (formato vacantes). */
  keyPoints: string[];
  blocks: ArticleBlock[];
  faqs: BlogFaq[];
  /** Fuentes citadas al final (legitiman autoridad editorial). */
  sources?: string[];
}

export interface BlogCategory {
  slug: string;
  name: string;
  description: string;
}
