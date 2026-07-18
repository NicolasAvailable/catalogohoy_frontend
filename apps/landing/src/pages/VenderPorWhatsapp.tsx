import { Link } from "react-router-dom";
import {
  ArrowRight,
  MessageCircle,
  LayoutGrid,
  Share2,
  ClipboardList,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import Navbar from "@/components/landing/Navbar";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

/**
 * Guía SEO de intención media/alta: "cómo vender por WhatsApp".
 * Contenido único (no reusa las secciones del home) para no competir con la
 * propia home por duplicado y para rankear por su cuenta.
 */

const faqs = [
  {
    question: "¿Necesito WhatsApp Business para vender?",
    answer:
      "No es obligatorio, pero es muy recomendable. WhatsApp Business es gratis y te da perfil de negocio, respuestas rápidas y etiquetas para organizar chats. Lo que sí te conviene es tener un catálogo digital aparte con enlace propio, para no depender solo del catálogo interno de WhatsApp.",
  },
  {
    question: "¿Cómo hago un catálogo para vender por WhatsApp?",
    answer:
      "Con CatalogoHoy creas un catálogo digital en minutos: subes tus productos con foto y precio, personalizas el diseño y obtienes un enlace único. Ese enlace lo compartes por WhatsApp y tus clientes arman su pedido desde ahí. Puedes empezar gratis, sin tarjeta.",
  },
  {
    question: "¿Puedo recibir y cobrar pedidos por WhatsApp?",
    answer:
      "Sí. Cuando un cliente termina su pedido en tu catálogo, te llega ordenado por WhatsApp con los productos, cantidades y total. Desde ahí coordinas el pago (transferencia, pago móvil, efectivo o pasarela) y la entrega.",
  },
  {
    question: "¿Cuánto cuesta empezar a vender por WhatsApp?",
    answer:
      "Empezar cuesta $0. WhatsApp y WhatsApp Business son gratis, y CatalogoHoy tiene un plan gratuito para siempre con hasta 10 productos. Subes de plan solo cuando tu catálogo crece.",
  },
];

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({
    "@type": "Question",
    name: f.question,
    acceptedAnswer: { "@type": "Answer", text: f.answer },
  })),
};

const steps = [
  {
    icon: LayoutGrid,
    title: "1. Arma tu catálogo digital",
    body: "Sube tus productos con foto, nombre, precio y una descripción corta. Agrúpalos por categorías (por ejemplo: ropa, ofertas, novedades) para que el cliente encuentre rápido. Un catálogo ordenado vende más que una lista de fotos suelta en el chat.",
  },
  {
    icon: Share2,
    title: "2. Comparte tu enlace",
    body: "Tu catálogo tiene un enlace único. Pégalo en tu estado de WhatsApp, en tu bio de Instagram y en cada conversación. En vez de mandar 20 fotos una por una, mandas un solo link donde el cliente ve todo tu inventario actualizado.",
  },
  {
    icon: ClipboardList,
    title: "3. Recibe pedidos ordenados",
    body: "El cliente elige lo que quiere y arma su carrito. Cuando confirma, te llega el pedido por WhatsApp ya listo: qué productos, cuántos y el total. Se acabó el 'sumame a ver cuánto es' y los errores de cuentas.",
  },
  {
    icon: MessageCircle,
    title: "4. Coordina pago y entrega",
    body: "Respondes por el mismo WhatsApp para acordar el método de pago (transferencia, pago móvil, efectivo o pasarela) y el envío. Todo el hilo queda en un solo lugar, fácil de seguir.",
  },
];

const VenderPorWhatsapp = () => {
  usePageMeta({
    title: "Cómo vender por WhatsApp: guía paso a paso (2026) — CatalogoHoy",
    description:
      "Aprende a vender por WhatsApp desde cero: arma tu catálogo digital, comparte tu enlace, recibe pedidos ordenados y coordina pago y entrega. Guía práctica para negocios en Latinoamérica.",
    path: "/vender-por-whatsapp",
    jsonLd: JSON_LD,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* ═══ Encabezado ═══ */}
        <section className="pt-32 pb-6 md:pt-40">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-primary-50 px-4 py-1.5 text-sm font-semibold text-primary-700">
              <MessageCircle className="h-4 w-4" /> Guía práctica
            </span>
            <h1 className="mt-5 font-display font-extrabold text-4xl md:text-5xl text-foreground leading-tight">
              Cómo vender por WhatsApp paso a paso
            </h1>
            <p className="mt-5 text-lg md:text-xl text-muted-foreground leading-relaxed">
              WhatsApp es donde ya están tus clientes. En esta guía te mostramos
              cómo convertirlo en un canal de ventas ordenado —con catálogo,
              pedidos y cobros— sin necesidad de una tienda online complicada ni
              saber de tecnología.
            </p>
          </div>
        </section>

        {/* ═══ Por qué ═══ */}
        <section className="py-10">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              ¿Por qué vender por WhatsApp?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              En Latinoamérica, WhatsApp es la app que todos abren varias veces
              al día. Tus clientes no tienen que descargar nada nuevo ni crear
              una cuenta: te escriben directo. Eso hace que vender por WhatsApp
              tenga una barrera de entrada mínima y una tasa de respuesta mucho
              más alta que un email o una web tradicional.
            </p>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              El problema aparece cuando el negocio crece: mandar fotos una por
              una, repetir precios, perder pedidos entre mensajes y hacer cuentas
              a mano. La solución no es dejar WhatsApp, sino ordenarlo con un{" "}
              <strong className="text-foreground">catálogo digital</strong> que
              haga el trabajo pesado por ti.
            </p>
          </div>
        </section>

        {/* ═══ Qué necesitas ═══ */}
        <section className="py-10 bg-card">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Lo que necesitas para empezar
            </h2>
            <ul className="mt-6 space-y-3">
              {[
                "Un número de WhatsApp (idealmente WhatsApp Business, que es gratis).",
                "Fotos de tus productos, aunque sean tomadas con el celular.",
                "Tus precios definidos.",
                "Un catálogo digital con enlace propio para compartir.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="mt-1 h-5 w-5 flex-shrink-0 text-primary" />
                  <span className="text-lg text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ═══ Paso a paso ═══ */}
        <section className="py-14">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Vender por WhatsApp en 4 pasos
            </h2>
            <div className="mt-8 space-y-6">
              {steps.map((step) => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-card p-6"
                >
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
                    <step.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-xl text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-2 text-lg text-muted-foreground leading-relaxed">
                      {step.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-2xl bg-primary-50 p-6 text-center">
              <p className="text-lg text-foreground">
                Con <strong>CatalogoHoy</strong> haces los 4 pasos desde un solo
                lugar y gratis.
              </p>
              <a
                href="https://auth.catalogohoy.com/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-7 py-3 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary-700 hover:scale-105"
              >
                Crear mi catálogo gratis
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* ═══ Business vs catálogo ═══ */}
        <section className="py-10 bg-card">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              WhatsApp Business y catálogo digital: no es lo uno o lo otro
            </h2>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed">
              WhatsApp Business trae un catálogo interno, pero es limitado: vive
              dentro de la app, es difícil de organizar por categorías y no le
              das un enlace propio con tu marca. Un catálogo digital como el de{" "}
              <Link
                to="/features"
                className="font-semibold text-primary hover:underline"
              >
                CatalogoHoy
              </Link>{" "}
              se combina con WhatsApp: el cliente navega tu catálogo con tu
              diseño y, al confirmar, el pedido cae en tu WhatsApp. Lo mejor de
              los dos mundos.
            </p>
          </div>
        </section>

        {/* ═══ Errores comunes ═══ */}
        <section className="py-10">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground">
              Errores comunes al vender por WhatsApp
            </h2>
            <ul className="mt-6 space-y-3">
              {[
                "Mandar decenas de fotos sueltas en vez de un catálogo con enlace.",
                "No poner los precios visibles y responder 'te paso precio por interno'.",
                "Hacer las cuentas del pedido a mano (errores y demoras).",
                "No tener un lugar donde ver qué pedidos están pendientes.",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <XCircle className="mt-1 h-5 w-5 flex-shrink-0 text-destructive" />
                  <span className="text-lg text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
              ¿Quieres saber qué plan te conviene según tu cantidad de productos?
              Mira los{" "}
              <Link
                to="/pricing"
                className="font-semibold text-primary hover:underline"
              >
                planes y precios
              </Link>
              .
            </p>
          </div>
        </section>

        {/* ═══ FAQ ═══ */}
        <section className="py-14 bg-card">
          <div className="container mx-auto px-4 max-w-3xl">
            <h2 className="font-display font-bold text-2xl md:text-3xl text-foreground text-center">
              Preguntas frecuentes
            </h2>
            <div className="mt-8 space-y-6">
              {faqs.map((f) => (
                <div key={f.question}>
                  <h3 className="font-display font-semibold text-lg text-foreground">
                    {f.question}
                  </h3>
                  <p className="mt-2 text-lg text-muted-foreground leading-relaxed">
                    {f.answer}
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

export default VenderPorWhatsapp;
