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
    title: "CatalogoHoy — Crea tu catálogo digital gratis en minutos",
    description:
      "Crea catálogos digitales profesionales para tu tienda de ropa o negocio. Sube productos, personaliza el diseño, comparte por WhatsApp y recibe órdenes. Empieza gratis hoy.",
    path: "/",
    jsonLd: JSON_LD,
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
        <AiFeatures />
        <Testimonials />
        <Pricing />
        <FAQ />
        <Contact />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
