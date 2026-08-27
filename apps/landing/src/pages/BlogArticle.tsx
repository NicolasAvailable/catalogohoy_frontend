import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import Footer from "@/components/landing/Footer";
import BlogCover from "@/components/landing/BlogCover";
import { usePageMeta } from "@/hooks/use-page-meta";
import { categoryBySlug, findArticle, relatedArticles, signupUrl } from "@/blog";
import type { ArticleBlock } from "@/blog/types";
import NotFound from "./NotFound";

const BASE_URL = "https://catalogohoy.com";

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("es-419", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

/** Render de cada bloque tipado del artículo (formato estilo vacantes.com). */
const Block = ({ block, campaign }: { block: ArticleBlock; campaign: string }) => {
  switch (block.type) {
    case "p":
      return (
        <p
          className="text-base leading-relaxed text-foreground/85 [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2"
          dangerouslySetInnerHTML={{ __html: block.html }}
        />
      );
    case "h2":
      return (
        <h2
          id={block.id}
          className="font-display font-bold text-2xl mt-10 scroll-mt-28"
        >
          {block.text}
        </h2>
      );
    case "h3":
      return <h3 className="font-display font-semibold text-xl mt-6">{block.text}</h3>;
    case "ul":
      return (
        <ul className="flex flex-col gap-2.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-foreground/85 leading-relaxed">
              <CheckCircle2 className="w-[18px] h-[18px] text-primary shrink-0 mt-1" />
              <span dangerouslySetInnerHTML={{ __html: item }} />
            </li>
          ))}
        </ul>
      );
    case "ol":
      return (
        <ol className="flex flex-col gap-2.5 list-decimal pl-6 marker:font-semibold marker:text-primary">
          {block.items.map((item, i) => (
            <li key={i} className="text-foreground/85 leading-relaxed pl-1">
              <span dangerouslySetInnerHTML={{ __html: item }} />
            </li>
          ))}
        </ol>
      );
    case "table":
      return (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60">
                {block.headers.map((h, i) => (
                  <th key={i} className="text-left font-semibold px-4 py-3 whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, i) => (
                <tr key={i} className="border-t border-border">
                  {row.map((cell, j) => (
                    <td key={j} className={`px-4 py-3 ${j === 0 ? "font-medium" : "text-foreground/80"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "cta":
      return (
        <div className="rounded-2xl bg-gradient-to-br from-primary to-indigo-600 p-6 md:p-8 text-white my-2">
          <p className="font-display font-bold text-xl">{block.title}</p>
          <p className="mt-1.5 text-white/85 text-sm leading-relaxed">{block.text}</p>
          <a
            href={signupUrl(campaign)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 mt-4 bg-white text-primary font-semibold text-sm rounded-full px-5 py-2.5 hover:bg-white/90 transition-colors"
          >
            {block.button} <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      );
    case "quote":
      return (
        <blockquote className="border-l-4 border-primary pl-4 italic text-foreground/75">
          {block.text}
        </blockquote>
      );
    case "img":
      return (
        <figure className="my-2">
          <img
            src={block.src}
            alt={block.alt}
            loading="lazy"
            className="w-full rounded-2xl border border-border"
          />
          {block.caption && (
            <figcaption className="mt-2 text-center text-xs text-muted-foreground">
              {block.caption}
            </figcaption>
          )}
        </figure>
      );
    default:
      return null;
  }
};

const BlogArticlePage = () => {
  const { category: categorySlug = "", slug = "" } = useParams();
  const article = findArticle(categorySlug, slug);
  const category = categoryBySlug(categorySlug);

  // JSON-LD estable entre renders (regla de usePageMeta).
  const jsonLd = useMemo(() => {
    if (!article || !category) return undefined;
    const url = `${BASE_URL}/blog/${article.category}/${article.slug}`;
    return [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: article.title,
        description: article.metaDescription,
        datePublished: article.date,
        dateModified: article.date,
        inLanguage: "es",
        author: { "@type": "Organization", name: article.author, url: BASE_URL },
        publisher: { "@type": "Organization", name: "CatalogoHoy", url: BASE_URL },
        mainEntityOfPage: url,
      },
      {
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: article.faqs.map((f) => ({
          "@type": "Question",
          name: f.q,
          acceptedAnswer: { "@type": "Answer", text: f.a },
        })),
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Inicio", item: BASE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${BASE_URL}/blog` },
          { "@type": "ListItem", position: 3, name: category.name, item: `${BASE_URL}/blog/${category.slug}` },
          { "@type": "ListItem", position: 4, name: article.title, item: url },
        ],
      },
    ];
  }, [article, category]);

  usePageMeta({
    title: article?.metaTitle ?? "Artículo no encontrado | CatalogoHoy",
    description: article?.metaDescription ?? "",
    path: article ? `/blog/${article.category}/${article.slug}` : "/blog",
    jsonLd,
  });

  if (!article || !category) return <NotFound />;

  const toc = article.blocks.filter(
    (b): b is Extract<ArticleBlock, { type: "h2" }> => b.type === "h2"
  );
  const related = relatedArticles(article);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="pt-28 pb-20">
        <article className="container mx-auto px-4 max-w-3xl">
          {/* Breadcrumb */}
          <nav className="text-sm text-muted-foreground" aria-label="breadcrumb">
            <Link to="/" className="hover:text-foreground">Inicio</Link>
            <span className="mx-2">›</span>
            <Link to="/blog" className="hover:text-foreground">Blog</Link>
            <span className="mx-2">›</span>
            <Link to={`/blog/${category.slug}`} className="hover:text-foreground">
              {category.name}
            </Link>
          </nav>

          {/* Portada estilo vacantes (generada por CSS desde el título) */}
          <BlogCover
            article={article}
            className="mt-5 h-48 md:h-64 rounded-2xl"
            titleClass="text-2xl md:text-3xl"
          />

          {/* Título + meta */}
          <h1 className="font-display font-extrabold text-3xl md:text-4xl leading-tight mt-6">
            {article.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground mt-3">
            <span className="font-medium text-foreground/80">{article.author}</span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> {article.readMinutes} min de lectura
            </span>
            <time dateTime={article.date}>{formatDate(article.date)}</time>
          </div>

          {/* Puntos clave */}
          <section className="mt-8 rounded-2xl border border-primary/20 bg-primary/5 p-6">
            <h2 className="font-display font-bold text-lg">Puntos clave</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {article.keyPoints.map((point, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm leading-relaxed text-foreground/85">
                  <CheckCircle2 className="w-[18px] h-[18px] text-primary shrink-0 mt-0.5" />
                  {point}
                </li>
              ))}
            </ul>
          </section>

          {/* Tabla de contenidos */}
          <nav className="mt-6 rounded-2xl border border-border p-6" aria-label="Tabla de contenidos">
            <h2 className="font-display font-bold text-lg">En este artículo</h2>
            <ol className="mt-3 flex flex-col gap-2 list-decimal pl-5 marker:text-primary marker:font-semibold">
              {toc.map((h) => (
                <li key={h.id}>
                  <a href={`#${h.id}`} className="text-sm text-foreground/80 hover:text-primary transition-colors">
                    {h.text}
                  </a>
                </li>
              ))}
              <li>
                <a href="#faq" className="text-sm text-foreground/80 hover:text-primary transition-colors">
                  Preguntas frecuentes
                </a>
              </li>
            </ol>
          </nav>

          {/* Cuerpo */}
          <div className="mt-8 flex flex-col gap-5">
            {article.blocks.map((block, i) => (
              <Block key={i} block={block} campaign={article.slug} />
            ))}
          </div>

          {/* FAQ */}
          <section id="faq" className="mt-12 scroll-mt-28">
            <h2 className="font-display font-bold text-2xl">Preguntas frecuentes</h2>
            <div className="mt-4 flex flex-col gap-3">
              {article.faqs.map((f, i) => (
                <details key={i} className="group rounded-xl border border-border p-5">
                  <summary className="font-semibold cursor-pointer list-none flex items-center justify-between gap-4">
                    {f.q}
                    <span className="text-primary transition-transform group-open:rotate-45 text-xl leading-none shrink-0">+</span>
                  </summary>
                  <p className="mt-3 text-sm text-foreground/80 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </div>
          </section>

          {/* Fuentes */}
          {article.sources && article.sources.length > 0 && (
            <section className="mt-10 text-xs text-muted-foreground">
              <h2 className="font-semibold text-sm text-foreground/70">Fuentes</h2>
              <ul className="mt-2 flex flex-col gap-1 list-disc pl-5">
                {article.sources.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </section>
          )}

          {/* CTA final */}
          <div className="mt-12 rounded-2xl bg-gradient-to-br from-primary to-indigo-600 p-8 text-white text-center">
            <p className="font-display font-extrabold text-2xl">
              Crea tu catálogo y empieza a vender hoy
            </p>
            <p className="mt-2 text-white/85 max-w-md mx-auto">
              Gratis, sin tarjeta de crédito. Comparte tu enlace por WhatsApp y recibe pedidos ordenados.
            </p>
            <a
              href={signupUrl(article.slug)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-5 bg-white text-primary font-semibold rounded-full px-6 py-3 hover:bg-white/90 transition-colors"
            >
              Crear mi catálogo gratis <ArrowRight className="w-4 h-4" />
            </a>
          </div>

          {/* Relacionados */}
          {related.length > 0 && (
            <section className="mt-12">
              <h2 className="font-display font-bold text-2xl">Sigue leyendo</h2>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                {related.map((r) => (
                  <Link
                    key={r.slug}
                    to={`/blog/${r.category}/${r.slug}`}
                    className="group rounded-xl border border-border p-5 hover:shadow-md transition-shadow"
                  >
                    <span className="text-xs font-semibold text-primary">
                      {categoryBySlug(r.category)?.name}
                    </span>
                    <p className="font-display font-semibold leading-snug mt-1.5 group-hover:text-primary transition-colors">
                      {r.title}
                    </p>
                    <span className="text-xs text-muted-foreground mt-2 inline-block">
                      {r.readMinutes} min de lectura
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </main>
      <Footer />
    </div>
  );
};

export default BlogArticlePage;
