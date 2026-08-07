import { Link } from "react-router-dom";
import Navbar from "@/components/landing/Navbar";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const SIGNUP_URL = "https://auth.catalogohoy.com/signup";

const FAQS = [
  {
    q: "¿De verdad es gratis crear un catálogo online?",
    a: "Sí. Puedes crear tu catálogo online gratis, sin tarjeta de crédito y sin período de prueba que caduca. El plan gratuito incluye hasta 10 productos, un catálogo y tu enlace para compartir por WhatsApp.",
  },
  {
    q: "¿Necesito tarjeta de crédito para empezar?",
    a: "No. Te registras con tu correo, subes tus productos y compartes el enlace. Solo dejas datos de pago si más adelante decides pasar a un plan con más productos o funciones.",
  },
  {
    q: "¿Cuánto tarda en estar listo mi catálogo?",
    a: "Minutos. Creas la cuenta, subes tus primeros productos con foto y precio, personalizas el diseño y ya tienes un enlace listo para enviar a tus clientes. No necesitas conocimientos técnicos.",
  },
  {
    q: "¿Puedo agregar más productos después?",
    a: "Sí. Empiezas con hasta 10 productos gratis y, cuando tu negocio crezca, puedes ampliar el límite pasando a un plan pago sin perder lo que ya cargaste.",
  },
];

// JSON-LD a nivel de módulo (ref estable entre renders, como pide usePageMeta).
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: "Cómo crear un catálogo online gratis",
    description:
      "Crea tu catálogo online gratis, sube tus productos y compártelo por WhatsApp, en 4 pasos.",
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: "Regístrate gratis",
        text: "Crea tu cuenta en CatalogoHoy con tu correo, sin tarjeta de crédito, y abre tu primer catálogo.",
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: "Sube tus productos",
        text: "Agrega hasta 10 productos gratis con foto, precio y descripción. Puedes importarlos desde Excel o PDF.",
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: "Personaliza el diseño",
        text: "Ajusta colores, logo y orden de tus productos para que el catálogo se vea con tu marca.",
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: "Comparte tu enlace",
        text: "Copia el enlace único de tu catálogo y compártelo por WhatsApp, redes o donde vendas para recibir pedidos.",
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
    title: "Regístrate gratis",
    text: "Crea tu cuenta con tu correo en menos de un minuto. Sin tarjeta, sin prueba que caduca.",
  },
  {
    n: "2",
    title: "Sube tus productos",
    text: "Hasta 10 productos gratis con foto, precio y descripción. Importa desde Excel o PDF si ya los tienes.",
  },
  {
    n: "3",
    title: "Personaliza el diseño",
    text: "Ajusta colores, logo y el orden de tus productos para que el catálogo tenga tu marca.",
  },
  {
    n: "4",
    title: "Comparte tu enlace",
    text: "Copia tu enlace único y compártelo por WhatsApp o redes. Los pedidos te llegan directo al chat.",
  },
];

const FREE_FEATURES = [
  {
    title: "Un enlace listo para compartir",
    text: "Tu catálogo vive en una página que carga al instante. Sin apps que instalar ni PDF pesados que nadie abre.",
  },
  {
    title: "Pedidos por WhatsApp",
    text: "El cliente arma su pedido y te llega a tu WhatsApp con el detalle calculado, listo para confirmar.",
  },
  {
    title: "Fotos, precios y variantes",
    text: "Muestra cada producto con su foto, precio y opciones (talla, color) para que se vea profesional.",
  },
  {
    title: "Actualízalo cuando quieras",
    text: "Cambias un precio o agregas stock y el enlace se actualiza solo. No tienes que reenviar nada.",
  },
];

const MISTAKES = [
  {
    title: "Fotos oscuras o de baja calidad",
    text: "Es lo primero que ve el cliente. Usa buena luz y un fondo limpio; una foto clara vende más que diez borrosas.",
  },
  {
    title: "No usar categorías",
    text: "Un catálogo sin orden cansa. Agrupa por tipo de producto para que encuentren lo que buscan en segundos.",
  },
  {
    title: "Precios desactualizados",
    text: "Nada frustra más que un precio que ya cambió. Manténlos al día; en tu catálogo se actualiza en un toque.",
  },
  {
    title: "Descripciones vacías",
    text: "Una línea con material, medidas o beneficios evita preguntas repetidas y acelera la decisión de compra.",
  },
];

const CrearCatalogoOnlineGratis = () => {
  usePageMeta({
    title: "Crear catálogo online gratis en minutos | CatalogoHoy",
    description:
      "Crea tu catálogo online gratis, sin tarjeta de crédito: sube tus productos, personaliza el diseño y compártelo por WhatsApp. Empieza en minutos.",
    path: "/crear-catalogo-online-gratis",
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
              Crea tu catálogo online gratis en minutos
            </h1>
            <p className="mt-5 text-lg text-muted-foreground">
              Sube tus productos, personaliza el diseño y comparte tu enlace por
              WhatsApp. Sin tarjeta de crédito y sin complicaciones: empiezas hoy
              mismo.
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
                Ver todos los planes
              </Link>
            </div>
          </div>
        </section>

        {/* Gratis, sin tarjeta */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Crea tu catálogo gratis, sin tarjeta
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              No necesitas invertir nada para empezar a vender online. El plan
              gratuito de <strong>CatalogoHoy</strong> te deja publicar hasta{" "}
              <strong>10 productos</strong> en <strong>un catálogo</strong>, con
              tu <strong>enlace único para compartir</strong> y{" "}
              <strong>pedidos que llegan directo a tu WhatsApp</strong>. Sin
              tarjeta de crédito, sin período de prueba que caduca y sin letra
              chica: creas la cuenta y en minutos tienes una vitrina lista para
              enviar a tus clientes.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Es la forma más rápida de dejar de mandar fotos sueltas o un{" "}
              <Link to="/catalogo-digital" className="text-primary hover:underline">
                catálogo digital
              </Link>{" "}
              improvisado y pasar a algo que se ve profesional. Todo lo que
              cargues es tuyo: si más adelante decides crecer, amplías el límite
              sin volver a empezar.
            </p>
          </div>
        </section>

        {/* En 4 pasos */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              En 4 pasos y en minutos
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

        {/* Qué puedes hacer gratis */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Qué puedes hacer con el plan gratis
            </h2>
            <p className="mt-4 text-center text-muted-foreground max-w-2xl mx-auto">
              El plan gratuito no es una demo recortada: alcanza para vender de
              verdad desde el primer día.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {FREE_FEATURES.map((b) => (
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
            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿Vendes por chat? Mira cómo funciona un{" "}
              <Link
                to="/catalogo-por-whatsapp"
                className="text-primary hover:underline"
              >
                catálogo por WhatsApp
              </Link>{" "}
              paso a paso.
            </p>
          </div>
        </section>

        {/* Cuándo pasar a pago */}
        <section className="py-12 bg-card border-y border-border">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              ¿Cuándo conviene pasar a un plan pago?
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Empieza gratis y quédate ahí todo el tiempo que quieras. Un plan
              pago tiene sentido cuando tu catálogo empieza a quedarte chico: si
              necesitas <strong>más de 10 productos</strong>, quieres ver{" "}
              <strong>analíticas</strong> de qué se mira más, usar la{" "}
              <strong>IA</strong> para descripciones y fotos, o sumar a tu{" "}
              <strong>equipo</strong> para gestionar pedidos entre varios.
            </p>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Cuando llegue ese momento, revisa las opciones en{" "}
              <Link to="/pricing" className="text-primary hover:underline">
                nuestros planes
              </Link>{" "}
              y sube sin perder nada de lo que ya construiste.
            </p>
          </div>
        </section>

        {/* Errores comunes */}
        <section className="py-12">
          <div className="container mx-auto px-4 max-w-4xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Errores comunes al crear tu primer catálogo
            </h2>
            <p className="mt-4 text-center text-muted-foreground max-w-2xl mx-auto">
              Evítalos desde el inicio y tu catálogo venderá más sin esfuerzo
              extra.
            </p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {MISTAKES.map((m) => (
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

export default CrearCatalogoOnlineGratis;
