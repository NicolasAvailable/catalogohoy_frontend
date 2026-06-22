import { Link, useParams } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Layout } from "@/components/help/Layout";
import { Icon } from "@/components/help/Icon";
import { getCategory } from "@/content";
import { Seo, SITE_URL, breadcrumbJsonLd } from "@/lib/seo";
import NotFound from "./NotFound";

const CategoryPage = () => {
  const { categorySlug } = useParams();
  const category = categorySlug ? getCategory(categorySlug) : undefined;

  if (!category) return <NotFound />;

  const itemListJsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: category.title,
    itemListElement: category.articles.map((a, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: a.title,
      url: `${SITE_URL}/a/${a.slug}`,
    })),
  };

  return (
    <Layout>
      <Seo
        title={category.title}
        description={category.description}
        path={`/c/${category.slug}`}
        jsonLd={[
          breadcrumbJsonLd([
            { name: "Centro de ayuda", path: "/" },
            { name: category.title, path: `/c/${category.slug}` },
          ]),
          itemListJsonLd,
        ]}
      />
      <div className="container mx-auto max-w-3xl px-4 sm:px-6 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-foreground transition-colors">
            Centro de ayuda
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-foreground font-medium">{category.title}</span>
        </nav>

        {/* Header */}
        <div className="mt-6 flex items-start gap-4">
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon name={category.icon} className="h-6 w-6" strokeWidth={1.9} />
          </div>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-foreground">
              {category.title}
            </h1>
            <p className="mt-1 text-muted-foreground">{category.description}</p>
          </div>
        </div>

        {/* Articles */}
        <ul className="mt-8 divide-y divide-border/70 rounded-2xl border border-border/70 bg-white">
          {category.articles.map((a) => (
            <li key={a.slug}>
              <Link
                to={`/a/${a.slug}`}
                className="group flex items-center justify-between gap-4 px-5 py-4 hover:bg-muted/40 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
              >
                <div>
                  <p className="font-semibold text-foreground">{a.title}</p>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {a.description}
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Layout>
  );
};

export default CategoryPage;
