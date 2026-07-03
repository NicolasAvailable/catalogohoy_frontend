import { ArrowRight } from "lucide-react";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const rotatingWords = ["minutos", "segundos", "un clic"];

type SocialBrand = { name: string; logo: string };
const socialBrands: SocialBrand[] = [
  {
    name: "A1 Caraudio",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1775502698722_71.jpeg",
  },
  {
    name: "Franeleria",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1772051909574_LOGO_FRANELERIA.jpg",
  },
  {
    name: "Grupo Duvas",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1776481442179_We_ve_Hit_200k_Instagram_Follower_Post_Template.jpeg",
  },
  {
    name: "New Crown GL",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1775177585185_Copia_de_Copia_de_logotipo_new_crown.png",
  },
  {
    name: "Detalles CECY",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1775702729444_WhatsApp_Image_2026-04-03_at_3.15.13_PM.jpeg",
  },
  {
    name: "Essence Royale",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1776826276480_1000275966.jpeg",
  },
];

const Hero = () => {
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % rotatingWords.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      className="min-h-screen flex flex-col justify-center relative overflow-hidden pt-20 pb-12 lg:py-0"
      style={{ background: "linear-gradient(180deg, #ffffff 0%, #f8faff 40%, #eef4ff 70%, #dbeafe 100%)" }}
    >
      {/* Decorative blurred circles */}
      <div className="absolute top-20 left-1/4 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-indigo-200/20 rounded-full blur-3xl pointer-events-none" />

      <div className="container mx-auto px-6 relative z-10 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1.15fr_1fr] gap-10 lg:gap-12 items-center">

          {/* ═══ LEFT: Copy ═══ */}
          <div className="text-center lg:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display font-extrabold text-4xl sm:text-5xl md:text-6xl lg:text-6xl xl:text-7xl text-foreground leading-[1.1] tracking-tight"
            >
              Crea tu catálogo digital en{" "}
              <span className="relative inline-block">
                <AnimatePresence mode="wait">
                  <motion.span
                    key={rotatingWords[wordIndex]}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.4 }}
                    className="text-primary inline-block"
                  >
                    {rotatingWords[wordIndex]}
                  </motion.span>
                </AnimatePresence>
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-6 text-lg md:text-xl text-muted-foreground max-w-xl mx-auto lg:mx-0 leading-relaxed"
            >
              Diseña, organiza y comparte catálogos profesionales para tu tienda.
              Ideal para tiendas de ropa y cualquier tipo de negocio.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 flex flex-col sm:flex-row items-center lg:items-start lg:justify-start justify-center gap-4"
            >
              <a
                href="https://auth.catalogohoy.com/signup" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary-700 transition-all hover:shadow-xl hover:shadow-primary/30 hover:scale-105"
              >
                Comenzar gratis
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-8 py-3.5 text-base font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Ver características
              </a>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-8 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3 sm:gap-4"
            >
              <div className="flex -space-x-2">
                {socialBrands.map((brand, i) => (
                  <img
                    key={i}
                    src={brand.logo}
                    alt={brand.name}
                    loading="lazy"
                    className="w-10 h-10 rounded-full ring-2 ring-white object-cover bg-white shadow-sm"
                  />
                ))}
                <div className="w-10 h-10 rounded-full ring-2 ring-white bg-foreground text-white text-[0.65rem] font-bold flex items-center justify-center shadow-sm">
                  +500
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">+500 negocios</span>{" "}
                ya usan CatalogoHoy
              </p>
            </motion.div>
          </div>

          {/* ═══ RIGHT: Photo ═══ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="relative hidden lg:flex justify-end order-last"
          >
            <div className="relative w-[280px] sm:w-[340px] lg:w-[420px]">
              {/* Circular indigo background */}
              <div
                className="rounded-full aspect-square"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, #818cf8 0%, #6366f1 55%, #4f46e5 100%)",
                  boxShadow: "0 30px 60px -20px rgba(79, 70, 229, 0.45)",
                }}
              />
              {/* Photo (overlaid on top of circle, head pokes out) */}
              <img
                src="/hero-photo.png"
                alt="Persona usando CatalogoHoy"
                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-auto pointer-events-none select-none"
                draggable={false}
              />
            </div>
          </motion.div>

        </div>
      </div>

    </section>
  );
};

export default Hero;
