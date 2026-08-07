import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const SIGNUP_URL = "https://auth.catalogohoy.com/signup";

const FAQS = [
  {
    q: "¿Qué es un catálogo digital?",
    a: "Es una versión online de tu catálogo de productos: una página con fotos, precios, variantes y categorías que compartes con un enlace. A diferencia de un PDF o un catálogo impreso, se actualiza al instante y tus clientes pueden armar su pedido desde ahí.",
  },
  {
    q: "¿Cómo hago un catálogo digital gratis?",
    a: "Crea tu cuenta gratis en CatalogoHoy, sube tus productos con foto y precio, organiza tus categorías y comparte tu enlace. No necesitas tarjeta de crédito ni conocimientos técnicos.",
  },
  {
    q: "¿En qué se diferencia de un catálogo en PDF?",
    a: "El PDF es un archivo estático y pesado: cada cambio te obliga a rehacerlo y reenviarlo. Un catálogo digital vive en un enlace que carga al instante, tiene buscador y categorías, y se actualiza solo cuando cambias un precio o agregas un producto.",
  },
  {
    q: "¿Puedo recibir pedidos desde mi catálogo digital?",
    a: "Sí. Tus clientes eligen productos, cantidades y variantes, y el pedido te llega ordenado directo a tu WhatsApp para que confirmes el pago y la entrega.",
  },
  {
    q: "¿Necesito una página web para tener un catálogo digital?",
    a: "No. Tu catálogo digital ya es una página lista para compartir con su propio enlace. Puedes ponerlo en la biografía de tus redes, en tu estado de WhatsApp o donde vendas.",
  },
];

// JSON-LD a nivel de módulo (ref estable entre renders, como pide usePageMeta).
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cómo crear un catálogo digital",
    description:
      "Crea tu catálogo digital gratis, súbelo con tus productos y compártelo con un enlace, en 4 pasos.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Crea tu cuenta gratis",
        text: "Regístrate en CatalogoHoy gratis, sin tarjeta de crédito, y crea tu primer catálogo digital.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Sube tus productos",
        text: "Agrega fotos, precios, variantes y descripciones. Puedes importarlos desde Excel o PDF si ya los tienes.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Organiza en categorías",
        text: "Agrupa tus productos por categorías para que tus clientes encuentren todo rápido con el buscador.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Comparte tu enlace",
        text: "Personaliza el diseño con tu marca y comparte el enlace único de tu catálogo por WhatsApp, redes o donde vendas.",
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
    text: "Regístrate en menos de un minuto, sin tarjeta. Creas tu primer catálogo digital al instante.",
  },
  {
    n: "2",
    title: "Sube tus productos",
    text: "Fotos, precios, variantes y descripciones. Importa desde Excel o PDF si ya los tienes.",
  },
  {
    n: "3",
    title: "Organiza en categorías",
    text: "Agrupa tus productos por categorías para que se encuentren rápido con el buscador.",
  },
  {
    n: "4",
    title: "Comparte tu enlace",
    text: "Personaliza el diseño y comparte el enlace único de tu catálogo por WhatsApp o donde vendas.",
  },
];

const BENEFITS = [
  {
    title: "Siempre actualizado",
    text: "Cambias un precio o agregas stock y el enlace se actualiza solo. Sin rehacer archivos ni reenviar nada.",
  },
  {
    title: "Se comparte con un link",
    text: "Un solo enlace que abres en WhatsApp, Instagram o donde vendas. Carga al instante, sin descargas.",
  },
  {
    title: "Buscador y categorías",
    text: "Tus clientes filtran por categoría y encuentran lo que buscan en segundos, no scrolleando un PDF eterno.",
  },
  {
    title: "Carga rápida y ligera",
    text: "Nada de archivos pesados que nadie termina de abrir. Tu catálogo se ve bien en cualquier teléfono.",
  },
  {
    title: "Pedidos ordenados",
    text: "El cliente elige cantidades y variantes; el pedido te llega claro y calculado, listo para confirmar.",
  },
  {
    title: "Con la cara de tu marca",
    text: "Colores, logo y datos de tu negocio. Se ve profesional, no un documento genérico.",
  },
];

const MUST_HAVE = [
  {
    title: "Fotos claras",
    text: "Buenas imágenes de cada producto: es lo primero que decide si el cliente sigue mirando.",
  },
  {
    title: "Precios visibles",
    text: "Sin sorpresas. Un precio claro (con o sin variantes) evita idas y vueltas por chat.",
  },
  {
    title: "Variantes",
    text: "Tallas, colores o presentaciones con su propio precio y stock, para que el pedido salga bien.",
  },
  {
    title: "Categorías",
    text: "Un orden lógico que ayuda a navegar y encontrar rápido, sobre todo si tienes muchos productos.",
  },
  {
    title: "Botón de pedido por WhatsApp",
    text: "El paso final: que el cliente cierre el pedido y te llegue directo a tu chat para coordinar.",
  },
];

const NICHES = [
  "tiendas de ropa",
  "zapaterías",
  "cosméticos y belleza",
  "comida y restaurantes",
  "accesorios y joyería",
  "productos por catálogo",
];

const CatalogoDigital = () => {
  usePageMeta({
    title: "Catálogo digital: qué es y cómo crear el tuyo gratis | CatalogoHoy",
    description:
      "Descubre qué es un catálogo digital, sus ventajas frente al PDF o el catálogo físico, y cómo crear el tuyo gratis en minutos para vender online y por WhatsApp.",
    path: "/catalogo-digital",
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
              Catálogo digital: qué es y cómo crear el tuyo gratis
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Aprende qué es un catálogo digital, por qué le gana al PDF y al
              catálogo impreso, y cómo armar el tuyo en minutos para vender
              online y por WhatsApp. Gratis, sin tarjeta de crédito.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={SIGNUP_URL}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Crear mi catálogo gratis
              </a>
              <Link
                to="/pricing"
                className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Ver planes y precios
              </Link>
            </div>
          </div>
        </section>

        {/* Qué es */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              ¿Qué es un catálogo digital?
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Un catálogo digital es la versión online de tu catálogo de
              productos: una página con fotos, precios, variantes y categorías
              que vive en un enlace y compartes con quien quieras. En lugar de un
              archivo que tu cliente descarga, es una vitrina que se abre al
              instante desde cualquier teléfono, con buscador y todo ordenado.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              La gran diferencia con un PDF o un catálogo impreso es que está
              <strong> vivo</strong>: cambias un precio, agregas un producto o se
              agota el stock, y el enlace refleja el cambio solo. Además, tus
              clientes no solo miran: pueden armar su pedido ahí mismo y
              enviártelo. Es la forma más simple de vender online sin montar una
              tienda compleja.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Si ya vendes por chat, un{" "}
              <Link
                to="/catalogo-por-whatsapp"
                className="text-primary hover:underline"
              >
                catálogo por WhatsApp
              </Link>{" "}
              es exactamente esto llevado a donde ya están tus clientes: el
              pedido te llega directo a tu WhatsApp.
            </p>
          </div>
        </section>

        {/* Ventajas frente al PDF / físico */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Ventajas frente al PDF y al catálogo físico
            </h2>
            <p className="mt-4 text-muted-foreground text-center max-w-2xl mx-auto">
              El PDF y el impreso quedan desactualizados apenas cambias algo. Un
              catálogo digital resuelve justo eso:
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {BENEFITS.map((b) => (
                <div
                  key={b.title}
                  className="rounded-xl border border-border bg-background p-6"
                >
                  <h3 className="font-semibold text-foreground">{b.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {b.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Qué debe tener */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Qué debe tener un buen catálogo digital
            </h2>
            <p className="mt-4 text-muted-foreground text-center max-w-2xl mx-auto">
              No es solo poner productos: lo que hace que un catálogo venda son
              estos cinco elementos.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {MUST_HAVE.map((m) => (
                <div
                  key={m.title}
                  className="rounded-xl border border-border bg-card p-6"
                >
                  <h3 className="font-semibold text-foreground">{m.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {m.text}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Cómo crear en 4 pasos */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Cómo crear tu catálogo digital en 4 pasos
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
            <p className="mt-8 text-center text-sm text-muted-foreground">
              ¿Quieres el paso a paso completo?{" "}
              <Link
                to="/crear-catalogo-online-gratis"
                className="text-primary hover:underline"
              >
                Aprende a crear tu catálogo online gratis
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Nichos / internal linking */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Para qué negocios sirve
            </h2>
            <p className="mt-4 text-muted-foreground">
              Cualquier negocio con productos puede tener su catálogo digital.
              Estos son algunos que ya lo usan todos los días:
            </p>
            <ul className="mt-6 flex flex-wrap justify-center gap-3">
              {NICHES.map((n) => (
                <li
                  key={n}
                  className="rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground"
                >
                  {n}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-muted-foreground">
              ¿Recién empiezas?{" "}
              <Link to="/pricing" className="text-primary hover:underline">
                Mira los planes
              </Link>{" "}
              — hay uno gratis para siempre.
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
                  className="rounded-xl border border-border bg-background p-6"
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

export default CatalogoDigital;
