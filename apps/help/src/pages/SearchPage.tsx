import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ChevronRight, SearchX } from "lucide-react";
import { Layout } from "@/components/help/Layout";
import { SearchBar } from "@/components/help/SearchBar";
import { searchArticles } from "@/content";
import { Seo } from "@/lib/seo";

const SearchPage = () => {
  const [params] = useSearchParams();
  const q = params.get("q") ?? "";

  const results = useMemo(() => searchArticles(q), [q]);

  return (
    <Layout withSearch={false}>
      <Seo title="Buscar" path="/buscar" noindex />
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-10">
        <div className="mb-8">
          <SearchBar size="lg" initial={q} autoFocus />
        </div>

        <p className="text-sm text-muted-foreground">
          {results.length}{" "}
          {results.length === 1 ? "resultado" : "resultados"} para{" "}
          <span className="font-semibold text-foreground">“{q}”</span>
        </p>

        {results.length === 0 ? (
          <div className="mt-10 flex flex-col items-center text-center text-muted-foreground">
            <SearchX className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 font-medium text-foreground">
              No encontramos artículos
            </p>
            <p className="mt-1 text-sm">
              Prueba con otras palabras o revisa las categorías desde el inicio.
            </p>
          </div>
        ) : (
          <ul className="mt-5 divide-y divide-border/70 rounded-2xl border border-border/70 bg-white">
            {results.map(({ article, category }) => (
              <li key={article.slug}>
                <Link
                  to={`/a/${article.slug}`}
                  className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/40 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                >
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-primary">
                      {category.title}
                    </p>
                    <p className="font-semibold text-foreground">
                      {article.title}
                    </p>
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {article.description}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Layout>
  );
};

export default SearchPage;
