import { Fragment, useState, type ReactNode } from "react";
import type { ArticleBlock } from "@/content";
import { Lightbulb, Info, TriangleAlert } from "lucide-react";

/** Renders lightweight **bold** and `code` inline markup. */
const inline = (text: string): ReactNode => {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**"))
      return (
        <strong key={i} className="font-semibold text-foreground">
          {p.slice(2, -2)}
        </strong>
      );
    if (p.startsWith("`") && p.endsWith("`"))
      return (
        <code
          key={i}
          className="rounded bg-muted px-1.5 py-0.5 text-[0.85em] font-mono text-foreground"
        >
          {p.slice(1, -1)}
        </code>
      );
    return <Fragment key={i}>{p}</Fragment>;
  });
};

const noteStyles = {
  info: { box: "bg-accent/60 border-primary/20", icon: "text-primary", Cmp: Info },
  tip: { box: "bg-emerald-50 border-emerald-200", icon: "text-emerald-600", Cmp: Lightbulb },
  warning: { box: "bg-amber-50 border-amber-200", icon: "text-amber-600", Cmp: TriangleAlert },
} as const;

const Figure = ({ src, alt, caption }: { src: string; alt?: string; caption?: string }) => {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="my-5">
      <img
        src={src}
        alt={alt ?? ""}
        loading="lazy"
        onError={() => setFailed(true)}
        className="w-full rounded-xl border border-border shadow-sm"
      />
      {caption && (
        <figcaption className="mt-2 text-center text-xs text-muted-foreground">
          {caption}
        </figcaption>
      )}
    </figure>
  );
};

export const ArticleBlocks = ({ blocks }: { blocks: ArticleBlock[] }) => {
  return (
    <div className="text-[0.95rem] leading-relaxed">
      {blocks.map((block, i) => {
        switch (block.type) {
          case "paragraph":
            return (
              <p key={i} className="my-4 text-muted-foreground">
                {inline(block.text)}
              </p>
            );
          case "heading":
            return (
              <h2
                key={i}
                className="mt-8 mb-3 font-display text-xl font-bold text-foreground"
              >
                {block.text}
              </h2>
            );
          case "list":
            return (
              <ul key={i} className="my-4 space-y-2">
                {block.items.map((item, j) => (
                  <li key={j} className="flex gap-2.5 text-muted-foreground">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                    <span>{inline(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case "steps":
            return (
              <ol key={i} className="my-5 space-y-5">
                {block.items.map((step, j) => (
                  <li key={j} className="flex gap-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                      {j + 1}
                    </span>
                    <div className="flex-1 pt-0.5">
                      <p className="text-muted-foreground">{inline(step.text)}</p>
                      {step.image && (
                        <Figure src={step.image} alt={step.imageAlt} />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            );
          case "note": {
            const s = noteStyles[block.variant ?? "info"];
            return (
              <div
                key={i}
                className={`my-5 flex gap-3 rounded-xl border p-4 ${s.box}`}
              >
                <s.Cmp className={`h-5 w-5 shrink-0 ${s.icon}`} />
                <p className="text-sm text-foreground/80">{inline(block.text)}</p>
              </div>
            );
          }
          case "image":
            return (
              <Figure key={i} src={block.src} alt={block.alt} caption={block.caption} />
            );
          default:
            return null;
        }
      })}
    </div>
  );
};
