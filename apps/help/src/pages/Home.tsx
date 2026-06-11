import { useEffect } from "react";
import { Layout } from "@/components/help/Layout";
import { SearchBar } from "@/components/help/SearchBar";
import { CategoryCard } from "@/components/help/CategoryCard";
import { categories } from "@/content";

const Home = () => {
  useEffect(() => {
    document.title = "Centro de ayuda | Catálogo Hoy";
  }, []);

  return (
    <Layout withSearch={false}>
      {/* Hero */}
      <section
        className="relative"
        style={{
          background:
            "linear-gradient(180deg, #0f1115 0%, #161922 55%, #1b1f2b 100%)",
        }}
      >
        <div className="container mx-auto max-w-3xl px-4 sm:px-6 pt-16 pb-14 text-center">
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-white">
            ¿Cómo podemos ayudarte?
          </h1>
          <p className="mt-3 text-white/60">
            Guías y respuestas para sacarle el máximo a tu catálogo.
          </p>
          <div className="mt-7 mx-auto max-w-xl">
            <SearchBar size="lg" />
          </div>
        </div>
      </section>

      {/* Category grid */}
      <section className="container mx-auto max-w-5xl px-4 sm:px-6 -mt-8 pb-10">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard key={c.slug} category={c} />
          ))}
        </div>
      </section>
    </Layout>
  );
};

export default Home;
