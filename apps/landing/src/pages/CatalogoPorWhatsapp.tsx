import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const SIGNUP_URL = "https://auth.catalogohoy.com/signup";

const FAQS = [
  {
    q: "¿Cómo hago un catálogo para vender por WhatsApp?",
    a: "Crea tu catálogo digital gratis en CatalogoHoy, sube tus productos con foto y precio, y comparte el enlace por WhatsApp. Tus clientes eligen lo que quieren y el pedido te llega a tu WhatsApp.",
  },
  {
    q: "¿Es gratis el catálogo por WhatsApp?",
    a: "Sí. El plan gratuito incluye hasta 10 productos y un catálogo, sin tarjeta de crédito. Puedes ampliar cuando tu negocio crezca.",
  },
  {
    q: "¿Los pedidos llegan directo a mi WhatsApp?",
    a: "Sí. Cuando un cliente termina su pedido en el catálogo, se genera un mensaje con el detalle que llega a tu número de WhatsApp para que confirmes y coordines el pago y la entrega.",
  },
];

// JSON-LD a nivel de módulo (ref estable entre renders, como pide usePageMeta).
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cómo crear un catálogo por WhatsApp",
    description:
      "Crea un catálogo digital y compártelo por WhatsApp para recibir pedidos, en 4 pasos.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Crea tu cuenta gratis",
        text: "Regístrate en CatalogoHoy gratis, sin tarjeta de crédito, y crea tu primer catálogo.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Sube tus productos",
        text: "Agrega fotos, precios, variantes y descripciones. Puedes importarlos desde Excel o PDF.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Personaliza y comparte el enlace",
        text: "Personaliza el diseño y comparte el enlace único de tu catálogo por WhatsApp, redes o donde quieras.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Recibe pedidos por WhatsApp",
        text: "Tus clientes arman su pedido en el catálogo y te llega directo a tu WhatsApp para cerrar la venta.",
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
    text: "Regístrate en menos de un minuto, sin tarjeta. Creas tu primer catálogo al instante.",
  },
  {
    n: "2",
    title: "Sube tus productos",
    text: "Fotos, precios, variantes y descripciones. Importa desde Excel o PDF si ya los tienes.",
  },
  {
    n: "3",
    title: "Comparte tu enlace",
    text: "Personaliza el diseño y comparte el enlace único de tu catálogo por WhatsApp o donde vendas.",
  },
  {
    n: "4",
    title: "Recibe pedidos",
    text: "El cliente arma su pedido y te llega directo a tu WhatsApp para cerrar la venta.",
  },
];

const BENEFITS = [
  {
    title: "Vende donde ya están tus clientes",
    text: "El 90% de las ventas de pequeños negocios en Latinoamérica pasan por WhatsApp. Tu catálogo vive justo ahí.",
  },
  {
    title: "Se ve profesional, no un PDF pesado",
    text: "Un enlace que carga al instante, con buscador, categorías y fotos ordenadas. Nada de archivos que nadie abre.",
  },
  {
    title: "Pedidos ordenados, sin errores",
    text: "El cliente elige cantidades y variantes; el pedido te llega claro y calculado, listo para confirmar.",
  },
  {
    title: "Actualízalo cuando quieras",
    text: "Cambias un precio o agregas stock y el enlace se actualiza solo. Sin reenviar nada.",
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

const CatalogoPorWhatsapp = () => {
  usePageMeta({
    title: "Catálogo por WhatsApp: crea el tuyo gratis y vende más | CatalogoHoy",
    description:
      "Crea un catálogo digital para vender por WhatsApp: sube tus productos, comparte un enlace y recibe pedidos directo en tu chat. Gratis, sin tarjeta. Empieza hoy.",
    path: "/catalogo-por-whatsapp",
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
              Catálogo por WhatsApp: crea el tuyo y vende sin fricción
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Arma tu catálogo digital, compártelo con un enlace y recibe los
              pedidos directo en tu WhatsApp. Empieza gratis, sin tarjeta de
              crédito.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={SIGNUP_URL}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Crear mi catálogo gratis
              </a>
              <Link
                to="/features"
                className="inline-flex items-center justify-center rounded-lg border border-border px-6 py-3 font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Ver todas las funciones
              </Link>
            </div>
          </div>
        </section>

        {/* Qué es */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              ¿Qué es un catálogo por WhatsApp?
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Un catálogo por WhatsApp es tu vitrina digital: una página con
              todos tus productos (fotos, precios y variantes) que compartes con
              un solo enlace. Tus clientes lo abren desde el chat, arman su
              pedido y este te llega a tu WhatsApp listo para confirmar. Es la
              forma más simple de vender online sin montar una tienda
              complicada ni depender de un PDF que nadie termina de abrir.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Con <strong>CatalogoHoy</strong> creas ese catálogo en minutos,
              lo personalizas con tu marca y lo mantienes siempre actualizado.
              Ideal para negocios que ya venden por WhatsApp y quieren verse
              más profesionales y ordenar sus pedidos.
            </p>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Cómo crear tu catálogo por WhatsApp en 4 pasos
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

        {/* Beneficios */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Por qué vender con un catálogo por WhatsApp
            </h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {BENEFITS.map((b) => (
                <div
                  key={b.title}
                  className="rounded-xl border border-border bg-card p-6"
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

        {/* Nichos / internal linking */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Perfecto para tu tipo de negocio
            </h2>
            <p className="mt-4 text-muted-foreground">
              Miles de negocios usan su catálogo por WhatsApp todos los días:
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
              ¿Recién empiezas?{" "}
              <Link to="/pricing" className="text-primary hover:underline">
                Mira los planes
              </Link>{" "}
              — hay uno gratis para siempre.
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-12">
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

export default CatalogoPorWhatsapp;
