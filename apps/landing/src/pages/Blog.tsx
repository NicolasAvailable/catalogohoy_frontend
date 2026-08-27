import { Link, useParams } from "react-router-dom";
import { Clock } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ARTICLES, CATEGORIES, articlesByCategory, categoryBySlug } from "@/blog";
import type { BlogArticle } from "@/blog/types";
import NotFound from "./NotFound";

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-419", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Portada decorativa por categoría (sin assets: gradiente + patrón). */
const COVER_GRADIENTS: Record<string, string> = {
  "ventas-por-whatsapp": "from-emerald-500 to-teal-600",
  "catalogo-digital": "from-primary to-indigo-600",
};

const ArticleCard = ({ article }: { article: BlogArticle }) => {
  const category = categoryBySlug(article.category);
  return (
    <Link
      to={`/blog/${article.category}/${article.slug}`}
      className="group flex flex-col rounded-2xl border border-border bg-white overflow-hidden hover:shadow-lg transition-shadow"
    >
      <div
        className={`h-36 bg-gradient-to-br ${COVER_GRADIENTS[article.category] ?? "from-primary to-indigo-600"} relative`}
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl" />
        <span className="absolute bottom-3 left-4 text-xs font-semibold text-white/90 bg-white/15 rounded-full px-3 py-1">
          {category?.name}
        </span>
      </div>
      <div className="flex flex-col gap-2 p-5 flex-1">
        <h2 className="font-display font-bold text-lg leading-snug group-hover:text-primary transition-colors">
          {article.title}
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed flex-1">
          {article.excerpt}
        </p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground pt-2">
          <span>{formatDate(article.date)}</span>
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" /> {article.readMinutes} min
          </span>
        </div>
      </div>
    </Link>
  );
};

/** Índice del blog (/blog) y vista por categoría (/blog/:category). */
const Blog = () => {
  const { category: categorySlug } = useParams();
  const category = categorySlug ? categoryBySlug(categorySlug) : undefined;

  usePageMeta({
    title: category
      ? `${category.name} — Blog de CatalogoHoy`
      : "Blog de CatalogoHoy: guías para vender más por WhatsApp",
    description: category
      ? category.description
      : "Guías prácticas y sin humo para crear tu catálogo digital, vender por WhatsApp y hacer crecer tu negocio en Latinoamérica.",
    path: category ? `/blog/${category.slug}` : "/blog",
  });

  if (categorySlug && !category) return <NotFound />;

  const articles = category ? articlesByCategory(category.slug) : ARTICLES;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="container mx-auto px-4 max-w-5xl">
          {/* Hero */}
          <div className="max-w-2xl">
            <nav className="text-sm text-muted-foreground mb-3" aria-label="breadcrumb">
              <Link to="/" className="hover:text-foreground">Inicio</Link>
              <span className="mx-2">›</span>
              {category ? (
                <>
                  <Link to="/blog" className="hover:text-foreground">Blog</Link>
                  <span className="mx-2">›</span>
                  <span className="text-foreground">{category.name}</span>
                </>
              ) : (
                <span className="text-foreground">Blog</span>
              )}
            </nav>
            <h1 className="font-display font-extrabold text-3xl md:text-4xl leading-tight">
              {category ? category.name : "El blog de CatalogoHoy"}
            </h1>
            <p className="mt-3 text-lg text-muted-foreground">
              {category
                ? category.description
                : "Guías prácticas y sin humo para vender más por WhatsApp y tus redes."}
            </p>
          </div>

          {/* Categorías */}
          <div className="flex flex-wrap gap-2 mt-8">
            <Link
              to="/blog"
              className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${!category ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}
            >
              Todos
            </Link>
            {CATEGORIES.map((c) => (
              <Link
                key={c.slug}
                to={`/blog/${c.slug}`}
                className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors ${category?.slug === c.slug ? "bg-primary text-white border-primary" : "border-border hover:border-primary/50"}`}
              >
                {c.name}
              </Link>
            ))}
          </div>

          {/* Grid de artículos */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-10">
            {articles.map((a) => (
              <ArticleCard key={a.slug} article={a} />
            ))}
          </div>
        </div>
      </main>
      <CTA />
      <Footer />
    </div>
  );
};

export default Blog;
