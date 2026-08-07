import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const SIGNUP_URL = "https://auth.catalogohoy.com/signup";

const FAQS = [
  {
    q: "¿Puedo agregar adicionales o extras a cada plato?",
    a: "Sí. A cada plato le sumas adicionales y extras opcionales: extra de queso, salsas, guarniciones, tamaño de la bebida o punto de cocción. El cliente los elige y el precio se calcula solo, sin que tengas que aclarar nada por chat.",
  },
  {
    q: "¿Actualizo los precios y la disponibilidad al instante?",
    a: "Sí. Cambias el precio de un plato o marcas algo como agotado y tu menú digital se actualiza al instante para todos. No reimprimes cartas ni reenvías PDF: el enlace siempre muestra lo que hoy tienes disponible.",
  },
  {
    q: "¿Sirve para delivery y para pedidos por WhatsApp?",
    a: "Sí. Tu menú digital está pensado para delivery y para llevar. El cliente arma su pedido, elige adicionales y lo confirma; el detalle te llega directo a tu WhatsApp para que coordines pago y entrega, sin comisiones por pedido.",
  },
];

// JSON-LD a nivel de módulo (ref estable entre renders, como pide usePageMeta).
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cómo crear el menú digital de tu restaurante",
    description:
      "Crea el menú digital de tu restaurante y compártelo por WhatsApp para recibir pedidos, en 4 pasos.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Crea tu cuenta gratis",
        text: "Regístrate en CatalogoHoy gratis, sin tarjeta de crédito, y crea el menú digital de tu restaurante.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Carga tus platos y categorías",
        text: "Organiza el menú en entradas, platos fuertes, postres y bebidas. Agrega fotos, precios, descripciones y adicionales a cada plato.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Personaliza y comparte el enlace",
        text: "Ajusta el menú con la marca de tu restaurante y comparte el enlace único por WhatsApp, Instagram o en las mesas con un código QR.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Recibe pedidos por WhatsApp",
        text: "Tus clientes eligen sus platos y adicionales, y el pedido te llega directo a tu WhatsApp para cerrar la venta y coordinar el delivery.",
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
    text: "Regístrate en menos de un minuto, sin tarjeta. Creas el menú digital de tu restaurante al instante.",
  },
  {
    n: "2",
    title: "Carga tus platos y categorías",
    text: "Ordena el menú en entradas, platos fuertes, postres y bebidas. Suma fotos, precios, descripciones y adicionales.",
  },
  {
    n: "3",
    title: "Comparte tu enlace",
    text: "Personaliza el diseño con tu marca y comparte el enlace por WhatsApp, Instagram o con un código QR en las mesas.",
  },
  {
    n: "4",
    title: "Recibe pedidos",
    text: "El cliente arma su pedido con adicionales y te llega directo a tu WhatsApp para confirmar y coordinar el delivery.",
  },
];

const BENEFITS = [
  {
    title: "Actualización al instante",
    text: "Cambias un precio o marcas un plato como agotado y el menú se actualiza solo. Nunca vendes lo que hoy no tienes.",
  },
  {
    title: "Pedidos por WhatsApp",
    text: "El cliente elige platos y adicionales; el pedido te llega claro y calculado a tu WhatsApp, listo para preparar y enviar.",
  },
  {
    title: "Sin comisiones por pedido",
    text: "A diferencia de las apps de delivery, no te cobramos un porcentaje por cada venta. El precio de tu plato es tuyo.",
  },
  {
    title: "Fotos que dan hambre",
    text: "Un menú visual con fotos ordenadas por categoría vende más que una carta en texto o un PDF que nadie termina de abrir.",
  },
];

const NICHES = [
  "restaurantes",
  "cafeterías",
  "food trucks",
  "dark kitchens",
  "panaderías",
  "delivery",
];

const MenuDigitalRestaurantes = () => {
  usePageMeta({
    title:
      "Menú digital para restaurantes: crea el tuyo gratis | CatalogoHoy",
    description:
      "Crea el menú digital de tu restaurante: platos con fotos y precios, pedidos por WhatsApp y actualización al instante. Gratis para empezar.",
    path: "/menu-digital-para-restaurantes",
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
              Menú digital para tu restaurante
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Cambia la carta en papel por un menú digital con fotos y precios.
              Compártelo con un enlace, recibe pedidos por WhatsApp y
              actualízalo al instante. Empieza gratis, sin tarjeta de crédito.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href={SIGNUP_URL}
                className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Crear mi menú digital gratis
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

        {/* Contexto del rubro */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              El menú digital que tu restaurante necesita
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              La carta en papel se ensucia, se desactualiza y cuesta reimprimir
              cada vez que cambia un precio. El PDF que mandas por WhatsApp pesa,
              tarda en abrir y termina siendo un archivo que nadie mira. Un menú
              digital resuelve las dos cosas: es una página que carga al
              instante, con tus platos ordenados por categoría, fotos, precios y
              descripciones, y que compartes con un solo enlace.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Con <strong>CatalogoHoy</strong> creas el menú digital de tu
              restaurante en minutos y lo tienes siempre al día. Tus clientes lo
              abren desde el chat, arman su pedido con adicionales y este te
              llega directo a tu WhatsApp para coordinar delivery, retiro o
              consumo en el local. Es la forma más simple de vender comida
              online sin pagar comisiones a una app de delivery ni montar una
              tienda complicada.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Funciona igual de bien si repartes por tu cuenta, si vendes para
              llevar o si atiendes en mesa con un código QR: un mismo menú, un
              mismo enlace, siempre con los precios y la disponibilidad de hoy.
            </p>
          </div>
        </section>

        {/* Platos con fotos, precios y adicionales */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Platos con fotos, precios y adicionales
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Organiza tu menú digital tal como lo piensa el cliente: entradas,
              platos fuertes, postres y bebidas. Cada categoría agrupa sus platos
              con foto, precio y una descripción corta con los ingredientes, para
              que se antojen antes de pedir. Las fotos que dan hambre venden más
              que cualquier lista en texto.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Lo mejor son los <strong>adicionales y extras</strong>: a cada
              plato le sumas opciones como extra de queso, salsas, guarniciones,
              tamaño de la bebida, punto de cocción o acompañamientos. El cliente
              arma su pedido a su gusto y el total se calcula solo, sin idas y
              vueltas por WhatsApp para aclarar precios. Menos errores, tickets
              más completos y una experiencia que se ve profesional desde el
              primer plato.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              ¿Ofreces combos o promociones del día? Los agregas como platos
              destacados y los quitas cuando terminan, sin tocar el resto del
              menú. Si vienes de otro rubro, este mismo motor es el que impulsa
              cualquier{" "}
              <Link
                to="/catalogo-digital"
                className="text-primary hover:underline"
              >
                catálogo digital
              </Link>{" "}
              de CatalogoHoy.
            </p>
          </div>
        </section>

        {/* Funciones clave */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Funciones clave para gastronomía
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
            <p className="mt-8 text-center text-sm text-muted-foreground">
              ¿Quieres ver cómo llegan los pedidos a tu chat? Mira cómo funciona
              un{" "}
              <Link
                to="/catalogo-por-whatsapp"
                className="text-primary hover:underline"
              >
                catálogo por WhatsApp
              </Link>
              .
            </p>
          </div>
        </section>

        {/* Cómo funciona */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Cómo crear tu menú digital en 4 pasos
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
              Todo tipo de negocio gastronómico usa su menú digital para vender
              más y ordenar sus pedidos:
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

export default MenuDigitalRestaurantes;
