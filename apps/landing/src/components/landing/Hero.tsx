import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";

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
];

const Hero = () => {
  return (
    <section className="relative overflow-hidden bg-white pt-40 pb-16 lg:pt-48 lg:pb-20">
      {/* Halo suave detrás del contenido */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-[32rem] w-[52rem] -translate-x-1/2 rounded-full bg-primary/5 blur-3xl" />

      <div className="container relative z-10 mx-auto max-w-6xl px-6">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-12">
          {/* ═══ LEFT: Copy ═══ */}
          <div className="text-center lg:text-left">
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight text-foreground sm:text-5xl md:text-6xl xl:text-[4.2rem]"
            >
              Crea tu catálogo
              <br />
              digital en <span className="text-primary">minutos</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground md:text-xl lg:mx-0"
            >
              Diseña, organiza y comparte catálogos profesionales para tu tienda.
              Publica tus productos y recibe pedidos por WhatsApp, Instagram y
              más — sin conocimientos técnicos.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-9 flex flex-col items-center gap-4 sm:flex-row lg:items-start lg:justify-start"
            >
              <a
                href="https://auth.catalogohoy.com/signup"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:bg-primary-700 hover:shadow-xl hover:shadow-primary/30"
              >
                Comenzar gratis
                <ArrowRight className="h-4 w-4" />
              </a>
              <a
                href="#features"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-white px-8 py-3.5 text-base font-semibold text-foreground transition-colors hover:bg-muted"
              >
                Ver funciones
              </a>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:gap-4 lg:justify-start"
            >
              <div className="flex -space-x-2">
                {socialBrands.map((brand, i) => (
                  <img
                    key={i}
                    src={brand.logo}
                    alt={brand.name}
                    loading="lazy"
                    className="h-10 w-10 rounded-full bg-white object-cover shadow-sm ring-2 ring-white"
                  />
                ))}
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-[0.65rem] font-bold text-white shadow-sm ring-2 ring-white">
                  +500
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  +500 negocios
                </span>{" "}
                ya usan CatalogoHoy
              </p>
            </motion.div>
          </div>

          {/* ═══ RIGHT: Foto ═══ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.2, ease: "easeOut" }}
            className="relative order-last hidden justify-end lg:flex"
          >
            <div className="relative w-[280px] sm:w-[340px] lg:w-[420px]">
              {/* Círculo de fondo */}
              <div
                className="aspect-square rounded-full"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, #818cf8 0%, #6366f1 55%, #4f46e5 100%)",
                  boxShadow: "0 30px 60px -20px rgba(79, 70, 229, 0.45)",
                }}
              />
              {/* Foto (sobre el círculo, la cabeza sobresale) */}
              <img
                src="/hero-photo.png"
                alt="Persona usando CatalogoHoy"
                className="pointer-events-none absolute bottom-0 left-1/2 h-auto w-full -translate-x-1/2 select-none"
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
