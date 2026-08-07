import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const SIGNUP_URL = "https://auth.catalogohoy.com/signup";

const FAQS = [
  {
    q: "¿Puedo poner tallas y colores en mi catálogo de ropa?",
    a: "Sí. Cada prenda puede tener sus variantes de talla (S, M, L, XL o numéricas) y de color, cada una con su propia foto y precio. Tu cliente elige la combinación exacta que quiere antes de hacer el pedido.",
  },
  {
    q: "¿Puedo manejar el stock por talla?",
    a: "Sí. Puedes indicar la disponibilidad de cada variante para que tus clientes solo pidan lo que tienes. Así evitas vender una talla agotada y coordinar cambios después.",
  },
  {
    q: "¿Sirve para vender ropa por WhatsApp e Instagram?",
    a: "Totalmente. Compartes el enlace de tu catálogo en tu bio de Instagram, en tus historias o directamente por WhatsApp, y los pedidos te llegan a tu chat listos para confirmar el pago y el envío.",
  },
  {
    q: "¿Puedo organizar mi ropa por temporada o colección?",
    a: "Sí. Creas categorías por tipo de prenda, temporada o colección (por ejemplo, verano, nueva temporada o rebajas) para que tus clientes encuentren rápido lo que buscan.",
  },
  {
    q: "¿Es gratis para una tienda de ropa que recién empieza?",
    a: "Sí. El plan gratuito te permite empezar a subir prendas y compartir tu catálogo sin tarjeta de crédito. Cuando tu tienda crezca, puedes ampliar el número de productos y variantes.",
  },
];

// JSON-LD a nivel de módulo (ref estable entre renders, como pide usePageMeta).
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cómo crear el catálogo de tu tienda de ropa",
    description:
      "Crea el catálogo digital de tu tienda de ropa con tallas, colores y fotos, y recibe pedidos por WhatsApp, en 4 pasos.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Crea tu cuenta gratis",
        text: "Regístrate en CatalogoHoy gratis, sin tarjeta de crédito, y crea el catálogo de tu tienda de ropa.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Sube tus prendas con fotos",
        text: "Agrega cada prenda con fotos claras, precio y descripción. Puedes importar tus productos desde Excel si ya los tienes.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Configura tallas, colores y stock",
        text: "Define las variantes de talla y color de cada prenda, con su propia foto y precio, e indica el stock disponible.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Comparte y recibe pedidos por WhatsApp",
        text: "Comparte el enlace de tu catálogo por WhatsApp e Instagram. Tus clientes eligen talla y color, y el pedido te llega a tu WhatsApp.",
      },
    ],
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  },
];

const STEPS = [
  {
    n: "1",
    title: "Crea tu cuenta gratis",
    text: "Regístrate en menos de un minuto, sin tarjeta. Creas el catálogo de tu tienda de ropa al instante.",
  },
  {
    n: "2",
    title: "Sube tus prendas con fotos",
    text: "Foto, precio y descripción por prenda. Importa desde Excel si ya tienes tu lista de productos.",
  },
  {
    n: "3",
    title: "Configura tallas y colores",
    text: "Agrega variantes de talla y color, cada una con su foto y precio, e indica el stock disponible.",
  },
  {
    n: "4",
    title: "Comparte y recibe pedidos",
    text: "Comparte tu enlace por WhatsApp e Instagram. El cliente elige talla y color y el pedido te llega al chat.",
  },
];

const FEATURES = [
  {
    title: "Galería de fotos por prenda",
    text: "Sube varias fotos por prenda para mostrar detalles, texturas y cómo se ve puesta. Tus clientes compran con más confianza cuando ven bien lo que ofreces.",
  },
  {
    title: "Categorías por tipo de prenda",
    text: "Organiza tu ropa en categorías: blusas, jeans, vestidos, abrigos, calzado o por temporada. Tu cliente encuentra rápido lo que busca.",
  },
  {
    title: "Precios y ofertas",
    text: "Muestra el precio de cada prenda y aplica descuentos o rebajas de temporada. Ideal para liquidar colecciones anteriores y destacar tus novedades.",
  },
  {
    title: "Pedidos por WhatsApp",
    text: "Cada pedido llega a tu WhatsApp con la prenda, la talla y el color elegidos. Confirmas el pago y coordinas el envío sin idas y vueltas.",
  },
];

const NICHES = [
  "boutiques",
  "ropa femenina",
  "ropa masculina",
  "ropa urbana",
  "ropa infantil",
  "calzado",
];

const CatalogoParaTiendasDeRopa = () => {
  usePageMeta({
    title: "Catálogo digital para tiendas de ropa | CatalogoHoy",
    description:
      "Crea el catálogo digital de tu tienda de ropa: muestra tus prendas con fotos, tallas y colores, y recibe pedidos por WhatsApp. Gratis para empezar.",
    path: "/catalogo-para-tiendas-de-ropa",
    jsonLd: JSON_LD,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Hero */}
        <section className="pt-32 pb-10 md:pt-40">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-foreground leading-tight">
              Catálogo digital para tu tienda de ropa
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Muestra tus prendas con fotos, tallas y colores, organiza tus
              colecciones y recibe los pedidos directo en tu WhatsApp. Empieza
              gratis, sin tarjeta de crédito.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={SIGNUP_URL}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Crear mi catálogo de ropa gratis
              </a>
              <Link
                to="/catalogo-por-whatsapp"
                className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Ver cómo vender por WhatsApp
              </Link>
            </div>
          </div>
        </section>

        {/* El catálogo que tu tienda de ropa necesita */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              El catálogo que tu tienda de ropa necesita
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              En el mundo de la moda todo cambia rápido: llegan colecciones
              nuevas, cambian las temporadas y cada semana tienes prendas que
              destacar. Un grupo de fotos sueltas por WhatsApp o un PDF pesado
              ya no alcanza para verse profesional ni para que tus clientes
              encuentren lo que buscan. Tu tienda de ropa necesita una vitrina
              digital ordenada, siempre actualizada y fácil de compartir.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Con <strong>CatalogoHoy</strong> creas el catálogo online de tu
              tienda de ropa en minutos: subes tus prendas con fotos, precios,
              tallas y colores, y las organizas por categoría o colección.
              Compartes un solo enlace por WhatsApp e Instagram, donde ya están
              tus clientes, y ellos arman su pedido eligiendo la talla y el
              color exactos. El pedido te llega a tu chat, listo para confirmar
              el pago y coordinar el envío. Ideal para boutiques y tiendas que
              venden por redes y quieren verse más profesionales sin montar una
              tienda online complicada.
            </p>
          </div>
        </section>

        {/* Muestra tallas, colores y variantes */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Muestra tallas, colores y variantes
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              La ropa se vende por talla y color, y tu catálogo lo entiende. En
              cada prenda defines sus variantes: talla S, M, L, XL o numéricas,
              y los colores disponibles. Lo mejor es que{" "}
              <strong>cada variante puede tener su propia foto y su propio
              precio</strong>, así el cliente ve exactamente cómo luce el color
              rojo frente al negro, o cómo cambia el modelo entre tallas.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              También puedes manejar el <strong>stock por talla</strong>: si
              una talla se agotó, tus clientes solo pedirán lo que tienes
              disponible. Se acabaron los mensajes de "no me queda esa talla"
              después de cerrar la venta. Todo queda claro desde el catálogo,
              tú vendes con menos fricción y tu cliente compra con más
              confianza.
            </p>
          </div>
        </section>

        {/* Funciones clave para moda */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Funciones clave para moda
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <h3 className="font-semibold text-foreground">{f.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {f.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo armar tu catálogo de ropa en 4 pasos */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Cómo armar tu catálogo de ropa en 4 pasos
            </h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2">
              {STEPS.map((s) => (
                <li key={s.n} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary font-display font-bold text-primary-foreground">
                    {s.n}
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {s.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Ideal para / internal linking */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Ideal para
            </h2>
            <p className="mt-4 text-muted-foreground">
              Cualquier tienda de ropa puede vender más con su catálogo digital:
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-3">
              {NICHES.map((n) => (
                <li
                  key={n}
                  className="rounded-full border border-border bg-background px-4 py-2 text-sm text-foreground"
                >
                  {n}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              ¿Quieres ver todo lo que puedes hacer? Conoce el{" "}
              <Link to="/catalogo-digital" className="text-primary hover:underline">
                catálogo digital
              </Link>{" "}
              y{" "}
              <Link to="/pricing" className="text-primary hover:underline">
                los planes
              </Link>{" "}
              — hay uno gratis para empezar hoy.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Preguntas frecuentes
            </h2>
            <div className="mt-8 space-y-6">
              {FAQS.map((f) => (
                <div
                  key={f.q}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <h3 className="font-semibold text-foreground">{f.q}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {f.a}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default CatalogoParaTiendasDeRopa;
