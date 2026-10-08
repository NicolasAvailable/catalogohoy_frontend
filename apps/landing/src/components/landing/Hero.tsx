import { ArrowRight, Check } from "lucide-react";
import { motion } from "framer-motion";

// Logo de Meta (infinito) — path de Simple Icons, color oficial #0081FB.
const MetaGlyph = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#0081FB" aria-hidden="true">
    <path d="M6.915 4.03c-1.968 0-3.683 1.28-4.871 3.113C.704 9.208 0 11.883 0 14.449c0 .706.07 1.369.21 1.973a6.624 6.624 0 0 0 .265.86 5.297 5.297 0 0 0 .371.761c.696 1.159 1.818 1.927 3.593 1.927 1.497 0 2.633-.671 3.965-2.444.76-1.012 1.144-1.626 2.663-4.32l.756-1.339.186-.325c.061.1.121.196.183.3l2.152 3.595c.724 1.21 1.665 2.556 2.47 3.314 1.046.987 1.992 1.22 3.06 1.22 1.075 0 1.876-.355 2.455-.843a3.743 3.743 0 0 0 .81-.973c.542-.939.861-2.127.861-3.745 0-2.72-.681-5.357-2.084-7.45-1.282-1.912-2.957-2.93-4.716-2.93-1.047 0-2.088.467-3.053 1.308-.652.57-1.257 1.29-1.82 2.05-.69-.875-1.335-1.547-1.958-2.056-1.182-.966-2.315-1.303-3.454-1.303zm10.16 2.053c1.147 0 2.188.758 2.992 1.999 1.132 1.748 1.647 4.195 1.647 6.4 0 1.548-.368 2.9-1.839 2.9-.58 0-1.027-.23-1.664-1.004-.496-.601-1.343-1.878-2.832-4.358l-.617-1.028a44.908 44.908 0 0 0-1.255-1.98c.07-.109.141-.224.211-.327 1.12-1.667 2.118-2.602 3.358-2.602zm-10.201.553c1.265 0 2.058.791 2.675 1.446.307.327.737.871 1.234 1.579l-1.02 1.566c-.757 1.163-1.882 3.017-2.837 4.338-1.191 1.649-1.81 1.817-2.486 1.817-.524 0-1.038-.237-1.383-.794-.263-.426-.464-1.13-.464-2.046 0-2.221.63-4.535 1.66-6.088.454-.687.964-1.226 1.533-1.533a2.264 2.264 0 0 1 1.088-.285z" />
  </svg>
);

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
    // En desktop el hero toma todo el viewport (min-h-screen + centrado):
    // "Cómo funciona" recién aparece al scrollear. En mobile fluye normal.
    <section className="relative overflow-hidden bg-white pt-40 pb-16 lg:flex lg:min-h-screen lg:items-center lg:pt-28 lg:pb-16">
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
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-[0.6rem] font-bold text-white shadow-sm ring-2 ring-white">
                  +5000
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  +5000 negocios
                </span>{" "}
                ya usan CatalogoHoy
              </p>
            </motion.div>

            {/* Meta Business Partner */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:gap-6 lg:justify-start"
            >
              <span className="flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#1877F2]">
                  <Check className="h-3 w-3 text-white" strokeWidth={3.5} />
                </span>
                <span className="text-sm font-semibold text-foreground">
                  Socios oficiales de Meta
                </span>
              </span>
              <span className="flex items-center gap-2" role="img" aria-label="Meta Business Partners">
                <MetaGlyph className="h-7 w-7" />
                <span className="text-left text-sm font-bold leading-[1.15] tracking-tight text-foreground">
                  Meta Business
                  <br />
                  Partners
                </span>
              </span>
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
              <picture className="contents">
                {/* WebP (55 kB vs 888 kB del PNG) con fallback. Es el LCP del
                    home → fetchPriority alto + preload en index.html; width/height
                    fijan el aspect-ratio para no generar CLS. */}
                <source srcSet="/hero-photo.webp" type="image/webp" />
                <img
                  src="/hero-photo.png"
                  alt="Persona usando CatalogoHoy"
                  width={992}
                  height={1077}
                  fetchPriority="high"
                  decoding="async"
                  className="pointer-events-none absolute bottom-0 left-1/2 h-auto w-full -translate-x-1/2 select-none"
                  draggable={false}
                />
              </picture>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
