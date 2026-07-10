import Navbar from "@/components/landing/Navbar";
import FAQ, { faqs } from "@/components/landing/FAQ";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.question,
    acceptedAnswer: {
      "@type": "Answer",
      text: faq.answer,
    },
  })),
};

const PreguntasFrecuentes = () => {
  usePageMeta({
    title: "Preguntas frecuentes — CatalogoHoy",
    description:
      "Respuestas a las dudas más comunes sobre CatalogoHoy: cómo crear tu catálogo digital gratis, compartirlo por WhatsApp, recibir órdenes, cambiar de plan y más.",
    path: "/preguntas-frecuentes",
    jsonLd: JSON_LD,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="pt-32 pb-4 md:pt-40">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-foreground leading-tight">
              Preguntas frecuentes
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Todo lo que necesitas saber antes de crear tu catálogo digital
              con CatalogoHoy. ¿No encuentras tu respuesta? Escríbenos y te
              ayudamos.
            </p>
          </div>
        </section>
        <FAQ />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default PreguntasFrecuentes;
