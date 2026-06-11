import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { ChevronRight, ArrowLeft } from "lucide-react";
import { Layout } from "@/components/help/Layout";
import { ArticleBlocks } from "@/components/help/ArticleBlocks";
import { getArticle } from "@/content";
import NotFound from "./NotFound";

const ArticlePage = () => {
  const { articleSlug } = useParams();
  const hit = articleSlug ? getArticle(articleSlug) : undefined;

  useEffect(() => {
    if (hit) document.title = `${hit.article.title} | Centro de ayuda`;
  }, [hit]);

  if (!hit) return <NotFound />;
  const { article, category } = hit;

  const related =
    article.related
      ?.map((slug) => getArticle(slug))
      .filter((r): r is NonNullable<typeof r> => Boolean(r)) ?? [];

  return (
    <Layout>
      <article className="container mx-auto max-w-3xl px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            Centro de ayuda
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link
            to={`/c/${category.slug}`}
            className="hover:text-foreground transition-colors"
          >
            {category.title}
          </Link>
        </nav>

        <h1 className="mt-5 font-display text-2xl sm:text-3xl font-extrabold text-foreground">
          {article.title}
        </h1>
        <p className="mt-2 text-lg text-muted-foreground">{article.description}</p>

        <hr className="my-6 border-border/70" />

        <ArticleBlocks blocks={article.blocks} />

        {/* Related */}
        {related.length > 0 && (
          <section className="mt-12">
            <h2 className="font-display text-sm font-bold uppercase tracking-wider text-muted-foreground">
              Artículos relacionados
            </h2>
            <ul className="mt-3 space-y-2">
              {related.map(({ article: r }) => (
                <li key={r.slug}>
                  <Link
                    to={`/a/${r.slug}`}
                    className="flex items-center gap-2 text-primary font-medium hover:gap-3 transition-all"
                  >
                    <ChevronRight className="h-4 w-4" />
                    {r.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <Link
          to={`/c/${category.slug}`}
          className="mt-12 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a {category.title}
        </Link>
      </article>
    </Layout>
  );
};

export default ArticlePage;
