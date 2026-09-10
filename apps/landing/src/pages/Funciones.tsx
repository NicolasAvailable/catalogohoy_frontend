import Navbar from "@/components/landing/Navbar";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import AiFeatures from "@/components/landing/AiFeatures";
import CTA from "@/components/landing/CTA";
import Footer from "@/components/landing/Footer";
import { usePageMeta } from "@/hooks/use-page-meta";

const Funciones = () => {
  usePageMeta({
    title: "Funciones — CatalogoHoy | Catálogo digital, WhatsApp e IA",
    description:
      "Descubre todo lo que puedes hacer con CatalogoHoy: catálogo digital personalizable, pedidos por WhatsApp, gestión de órdenes y clientes, precios en dos monedas e inteligencia artificial para tus fotos.",
    path: "/features",
  });

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        {/* Hero + secciones de contenido = UN solo bloque con degradado
            vertical blanco→azul (blanco arriba, azul abajo). Sin corte de
            color: las secciones (antes bg-white) van transparentes con
            `embedded` y muestran el degradado de la página. */}
        <div
          style={{
            background:
              "linear-gradient(180deg, #ffffff 0%, #f4f8ff 55%, #dbeafe 100%)",
          }}
        >
          <section className="pt-32 pb-4 md:pt-40">
            <div className="container mx-auto px-4 max-w-3xl text-center">
              <h1 className="font-display font-extrabold text-4xl md:text-5xl text-foreground leading-tight">
                Funciones de CatalogoHoy
              </h1>
              <p className="mt-4 text-lg text-muted-foreground">
                Todas las herramientas para mostrar tus productos, recibir
                pedidos por WhatsApp y hacer crecer tu negocio desde un solo
                lugar.
              </p>
            </div>
          </section>
          <HowItWorks embedded />
          <Features embedded />
          <AiFeatures embedded />
        </div>
        <CTA />
      </main>
      <Footer />
    </div>
  );
};

export default Funciones;
