import type { BlogArticle } from "@/blog/types";
import { categoryBySlug } from "@/blog";

/**
 * Portada estilo vacantes.com generada por CSS: lado izquierdo con foto (si
 * el artículo trae `coverImage`) o un patrón decorativo, y panel diagonal
 * degradado a la derecha con el título corto en dos tonos + tagline. Cada
 * artículo nuevo obtiene su portada automáticamente — sin diseñar imágenes.
 */
const GRADIENTS: Record<string, string> = {
  "ventas-por-whatsapp": "from-emerald-600 via-emerald-500 to-teal-500",
  "catalogo-digital": "from-primary via-indigo-500 to-violet-500",
  emprender: "from-fuchsia-600 via-purple-600 to-indigo-600",
};

/** Parte el título en (normal, acento) usando coverAccent como sufijo a resaltar. */
function splitTitle(article: BlogArticle): [string, string] {
  const title = article.coverTitle ?? article.title;
  const accent = article.coverAccent;
  if (accent && title.toLowerCase().endsWith(accent.toLowerCase())) {
    return [title.slice(0, title.length - accent.length).trimEnd(), accent];
  }
  return [title, ""];
}

const BlogCover = ({
  article,
  className = "",
  titleClass = "text-xl md:text-2xl",
}: {
  article: BlogArticle;
  className?: string;
  titleClass?: string;
}) => {
  const category = categoryBySlug(article.category);
  const gradient = GRADIENTS[article.category] ?? GRADIENTS["catalogo-digital"];
  const [main, accent] = splitTitle(article);

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {/* Lado izquierdo: foto o patrón decorativo */}
      <div className="absolute inset-0">
        {article.coverImage ? (
          <img
            src={article.coverImage}
            alt=""
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-[radial-gradient(circle_at_25%_30%,rgba(99,102,241,0.18),transparent_55%),radial-gradient(circle_at_10%_80%,rgba(16,185,129,0.14),transparent_45%)] bg-slate-100">
            <div
              className="absolute inset-0 opacity-[0.35]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(100,116,139,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(100,116,139,0.12) 1px, transparent 1px)",
                backgroundSize: "22px 22px",
              }}
            />
          </div>
        )}
      </div>

      {/* Panel diagonal con el título (estilo vacantes) */}
      <div
        className={`absolute inset-y-0 right-0 w-[68%] bg-gradient-to-br ${gradient}`}
        style={{ clipPath: "polygon(22% 0, 100% 0, 100% 100%, 0 100%)" }}
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/3 blur-xl" />
        <div className="h-full flex flex-col justify-center gap-2 pl-[26%] pr-5 py-4">
          <p className={`font-display font-extrabold text-white leading-[1.15] ${titleClass}`}>
            {main}
            {accent && <span className="text-white/70"> {accent}</span>}
          </p>
          {article.coverTagline && (
            <span className="text-[11px] font-semibold text-white/85">
              {article.coverTagline}
            </span>
          )}
        </div>
      </div>

      {/* Chip de categoría */}
      <span className="absolute bottom-3 left-4 text-[11px] font-semibold text-white bg-black/35 backdrop-blur-sm rounded-full px-3 py-1">
        {category?.name}
      </span>
    </div>
  );
};

export default BlogCover;
