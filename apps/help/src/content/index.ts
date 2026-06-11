import type { Article, Category } from "./types";
import { empezando } from "./categories/empezando";
import { productos } from "./categories/productos";
import { categorias } from "./categories/categorias";
import { pedidos } from "./categories/pedidos";
import { tasas } from "./categories/tasas";
import { pagos } from "./categories/pagos";
import { envios } from "./categories/envios";
import { whatsapp } from "./categories/whatsapp";
import { equipo } from "./categories/equipo";
import { referidos } from "./categories/referidos";
import { catalogo } from "./categories/catalogo";
import { cuenta } from "./categories/cuenta";

export type { Article, Category, ArticleBlock, StepItem } from "./types";

/** Display order on the home page. */
export const categories: Category[] = [
  empezando,
  productos,
  categorias,
  pedidos,
  tasas,
  pagos,
  envios,
  whatsapp,
  equipo,
  referidos,
  catalogo,
  cuenta,
];

export const getCategory = (slug: string): Category | undefined =>
  categories.find((c) => c.slug === slug);

export interface ArticleHit {
  article: Article;
  category: Category;
}

export const getArticle = (slug: string): ArticleHit | undefined => {
  for (const category of categories) {
    const article = category.articles.find((a) => a.slug === slug);
    if (article) return { article, category };
  }
  return undefined;
};

const blockText = (article: Article): string =>
  article.blocks
    .map((b) => {
      if (b.type === "paragraph" || b.type === "heading" || b.type === "note")
        return b.text;
      if (b.type === "list") return b.items.join(" ");
      if (b.type === "steps") return b.items.map((i) => i.text).join(" ");
      return "";
    })
    .join(" ");

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

export const searchArticles = (query: string): ArticleHit[] => {
  const q = normalize(query.trim());
  if (!q) return [];
  const terms = q.split(/\s+/);

  const scored: { hit: ArticleHit; score: number }[] = [];
  for (const category of categories) {
    for (const article of category.articles) {
      const title = normalize(article.title);
      const desc = normalize(article.description);
      const body = normalize(blockText(article));
      let score = 0;
      for (const t of terms) {
        if (title.includes(t)) score += 6;
        if (desc.includes(t)) score += 3;
        if (body.includes(t)) score += 1;
      }
      if (score > 0) scored.push({ hit: { article, category }, score });
    }
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.hit);
};

export const totalArticles = (): number =>
  categories.reduce((n, c) => n + c.articles.length, 0);
