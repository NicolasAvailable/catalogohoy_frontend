import { Link } from "react-router-dom";
import type { Category } from "@/content";
import { Icon } from "./Icon";

export const CategoryCard = ({ category }: { category: Category }) => {
  const count = category.articles.length;
  return (
    <Link
      to={`/c/${category.slug}`}
      className="group block rounded-2xl border border-border/70 bg-white p-6 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-1 transition-all duration-300"
    >
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
        <Icon name={category.icon} className="h-5 w-5" strokeWidth={1.9} />
      </div>
      <h3 className="font-display font-bold text-foreground">{category.title}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
        {category.description}
      </p>
      <p className="mt-4 text-xs font-medium text-muted-foreground">
        {count} {count === 1 ? "artículo" : "artículos"}
      </p>
    </Link>
  );
};
