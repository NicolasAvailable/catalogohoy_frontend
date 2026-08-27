import { Link, useParams } from "react-router-dom";
import { CalendarDays, Clock } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import BlogCover from "@/components/landing/BlogCover";
import { usePageMeta } from "@/hooks/use-page-meta";
import { ARTICLES, CATEGORIES, articlesByCategory, categoryBySlug } from "@/blog";
import type { BlogArticle } from "@/blog/types";
import NotFound from "./NotFound";

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-419", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

const Meta = ({ article }: { article: BlogArticle }) => (
  <div className="flex items-center gap-4 text-xs text-muted-foreground">
    <span className="flex items-center gap-1.5">
      <Clock className="w-3.5 h-3.5" /> {article.readMinutes} min de lectura
    </span>
    <span className="flex items-center gap-1.5">
      <CalendarDays className="w-3.5 h-3.5" /> {formatDate(article.date)}
    </span>
  </div>
);

const CategoryChip = ({ slug }: { slug: string }) => (
  <span className="inline-block text-xs font-semibold text-primary bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
    {categoryBySlug(slug)?.name}
  </span>
);

/** Card destacada (primer artículo): portada grande a la izquierda + texto. */
const FeaturedCard = ({ article }: { article: BlogArticle }) => (
  <Link
    to={`/blog/${article.category}/${article.slug}`}
    className="group grid grid-cols-1 md:grid-cols-2 rounded-2xl border border-border bg-white overflow-hidden hover:shadow-lg transition-shadow"
  >
    <BlogCover article={article} className="h-56 md:h-full min-h-[14rem]" titleClass="text-2xl md:text-3xl" />
    <div className="flex flex-col justify-center gap-3 p-6 md:p-8">
      <div><CategoryChip slug={article.category} /></div>
      <h2 className="font-display font-bold text-2xl leading-snug group-hover:text-primary transition-colors">
        {article.title}
      </h2>
      <p className="text-muted-foreground leading-relaxed">{article.excerpt}</p>
      <Meta article={article} />
    </div>
  </Link>
);

const ArticleCard = ({ article }: { article: BlogArticle }) => (
  <Link
    to={`/blog/${article.category}/${article.slug}`}
    className="group flex flex-col rounded-2xl border border-border bg-white overflow-hidden hover:shadow-lg transition-shadow"
  >
    <BlogCover article={article} className="h-44" titleClass="text-lg" />
    <div className="flex flex-col gap-2.5 p-5 flex-1">
      <div><CategoryChip slug={article.category} /></div>
      <h2 className="font-display font-bold text-lg leading-snug group-hover:text-primary transition-colors">
        {article.title}
      </h2>
      <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">
        {article.excerpt}
      </p>
      <Meta article={article} />
    </div>
  </Link>
);

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
      : "Consejos, guías y recursos para crear tu catálogo digital, vender por WhatsApp y hacer crecer tu negocio en Latinoamérica.",
    path: category ? `/blog/${category.slug}` : "/blog",
    image: "/blog/og/og-blog-index.jpg",
  });

  if (categorySlug && !category) return <NotFound />;

  const articles = category ? articlesByCategory(category.slug) : ARTICLES;
  const [featured, ...rest] = articles;

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Hero (caja estilo vacantes) */}
          <div className="rounded-3xl border border-border bg-gradient-to-r from-primary/5 via-white to-primary/5 px-6 py-12 md:py-16 text-center">
            <h1 className="font-display font-extrabold text-4xl md:text-5xl">
              {category ? category.name : "Blog"}
            </h1>
            <p className="mt-3 text-lg text-muted-foreground max-w-2xl mx-auto">
              {category
                ? category.description
                : "Consejos, guías y recursos para vender más con tu catálogo"}
            </p>
          </div>

          {/* Pills de categorías con conteo */}
          <div className="flex flex-wrap gap-2.5 mt-8">
            <Link
              to="/blog"
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${!category ? "bg-primary text-white border-primary" : "border-border bg-white hover:border-primary/50"}`}
            >
              Todas
            </Link>
            {CATEGORIES.map((c) => {
              const count = articlesByCategory(c.slug).length;
              const active = category?.slug === c.slug;
              return (
                <Link
                  key={c.slug}
                  to={`/blog/${c.slug}`}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${active ? "bg-primary text-white border-primary" : "border-border bg-white hover:border-primary/50"}`}
                >
                  {c.name}{" "}
                  <span className={active ? "text-white/70" : "text-muted-foreground"}>
                    {count}
                  </span>
                </Link>
              );
            })}
          </div>

          {/* Destacado + grid */}
          {featured && (
            <div className="mt-8">
              <FeaturedCard article={featured} />
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
            {rest.map((a) => (
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
