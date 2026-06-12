/**
 * Content model for the Catálogo Hoy help center.
 * Articles are authored as ordered blocks so we can mix prose, step lists,
 * screenshots and callouts — same idea as an Intercom article.
 */

export type ArticleBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; text: string }
  | { type: "steps"; items: StepItem[] }
  | { type: "list"; items: string[] }
  | { type: "note"; variant?: "info" | "tip" | "warning"; text: string }
  | { type: "image"; src: string; alt?: string; caption?: string };

export interface StepItem {
  /** Supports lightweight **bold** markers. */
  text: string;
  /** Path under /public, e.g. "/screenshots/productos/crear-1.png". */
  image?: string;
  imageAlt?: string;
}

export interface Article {
  slug: string;
  title: string;
  /** One-line summary shown in lists and meta description. */
  description: string;
  /** Optional related article slugs. */
  related?: string[];
  blocks: ArticleBlock[];
}

export interface Category {
  slug: string;
  title: string;
  description: string;
  /** lucide-react icon name (PascalCase import key resolved in the UI). */
  icon: string;
  articles: Article[];
}
