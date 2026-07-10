import Navbar from "@/components/landing/Navbar";
import Pricing from "@/components/landing/Pricing";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "CatalogoHoy",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: "https://catalogohoy.com",
  description:
    "Crea tu catálogo digital, comparte tus productos por WhatsApp y recibe órdenes online.",
  offers: [
    {
      "@type": "Offer",
      name: "Plan Gratis",
      price: "0",
      priceCurrency: "USD",
    },
    {
      "@type": "Offer",
      name: "Plan Básico",
      price: "9.99",
      priceCurrency: "USD",
    },
    {
      "@type": "Offer",
      name: "Plan Avanzado",
      price: "19.99",
      priceCurrency: "USD",
    },
  ],
};

const Precios = () => {
  usePageMeta({
    title: "Precios y planes — CatalogoHoy | Empieza gratis",
    description:
      "Planes de CatalogoHoy: empieza gratis y crece con los planes Básico y Avanzado. Catálogo digital, pedidos por WhatsApp, IA para tus fotos y más. Sin permanencia.",
    path: "/precios",
    jsonLd: JSON_LD,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="pt-32 pb-4 md:pt-40">
          <div className="container mx-auto px-4 max-w-3xl text-center">
            <h1 className="font-display font-extrabold text-4xl md:text-5xl text-foreground leading-tight">
              Planes y precios
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Empieza gratis y sube de plan cuando tu negocio lo necesite. Sin
              contratos, sin permanencia mínima y con la opción de pagar
              mensual, trimestral o anual con descuento.
            </p>
          </div>
        </section>
        <Pricing />
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Precios;
