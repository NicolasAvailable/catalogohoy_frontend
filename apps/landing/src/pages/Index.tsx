import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import AiFeatures from "@/components/landing/AiFeatures";
import Testimonials from "@/components/landing/Testimonials";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import Contact from "@/components/landing/Contact";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "CatalogoHoy",
  url: "https://catalogohoy.com",
  logo: "https://catalogohoy.com/favicon.png",
};

const Index = () => {
  usePageMeta({
    title: "CatalogoHoy | ERP para tu negocio: catálogo, ventas, inventario y POS",
    description:
      "CatalogoHoy es el ERP todo en uno para pequeños negocios: catálogo digital, pedidos por WhatsApp, inventario, Punto de Venta, clientes, reportes, Instagram/Facebook e IA. Empieza gratis.",
    path: "/",
    jsonLd: JSON_LD,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Testimonials />
        <Features />
        <AiFeatures />
        <Pricing />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
