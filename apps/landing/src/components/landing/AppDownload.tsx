import { motion } from "framer-motion";
import type { ReactNode } from "react";

export const APP_STORE_URL =
  "https://apps.apple.com/us/app/catalogohoy-cat%C3%A1logo-y-ventas/id6817059692?l=es-MX";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.catalogohoy.app";

// Logos monocromos (blanco) para los badges oscuros estilo tienda oficial.
const AppleGlyph = ({ className = "h-7 w-7" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
  </svg>
);

const PlayGlyph = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 512 512" className={className} fill="currentColor" aria-hidden="true">
    <path d="M47 24.6C40.4 28.7 36 36 36 45.4v421.2c0 9.4 4.4 16.7 11 20.8l236.3-231.4L47 24.6zM318.6 291.2 61.9 42.4l304.4 174.5-47.7 74.3zm0 0 47.7 74.3L61.9 469.6l256.7-178.4zM410.3 232.4l-55.2-31.6-52 76.8 52 76.8 55.2-31.6c17-9.8 17-34.3 0-44.1v-46.3z" />
  </svg>
);

type BadgeProps = { href: string; top: string; bottom: string; icon: ReactNode };

const StoreBadge = ({ href, top, bottom, icon }: BadgeProps) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="inline-flex items-center gap-3 rounded-xl bg-foreground px-5 py-3 text-white shadow-lg transition-all hover:scale-105 hover:shadow-xl"
  >
    <span className="shrink-0">{icon}</span>
    <span className="flex flex-col text-left leading-none">
      <span className="text-[0.65rem] font-medium opacity-80">{top}</span>
      <span className="font-display text-lg font-semibold tracking-tight">{bottom}</span>
    </span>
  </a>
);

/** Badges reutilizables para usar en otras secciones (p.ej. el footer). */
export const StoreBadges = ({ className = "" }: { className?: string }) => (
  <div className={`flex flex-wrap items-center gap-3 ${className}`}>
    <StoreBadge
      href={APP_STORE_URL}
      top="Descárgala en el"
      bottom="App Store"
      icon={<AppleGlyph className="h-7 w-7" />}
    />
    <StoreBadge
      href={PLAY_STORE_URL}
      top="Disponible en"
      bottom="Google Play"
      icon={<PlayGlyph className="h-6 w-6" />}
    />
  </div>
);

const AppDownload = () => {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="container mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-indigo-600 px-8 py-14 md:px-16 md:py-16"
        >
          {/* Decoración */}
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 -translate-y-1/2 translate-x-1/3 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 translate-y-1/2 -translate-x-1/3 rounded-full bg-white/10 blur-2xl" />

          <div className="relative z-10 flex flex-col items-center gap-6 text-center">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white ring-1 ring-white/25">
              📲 ¡Ya disponible!
            </span>
            <h2 className="font-display text-3xl font-extrabold leading-tight text-white md:text-4xl">
              Lleva tu negocio en el teléfono
            </h2>
            <p className="max-w-xl text-lg leading-relaxed text-white/85">
              Descarga la app de CatalogoHoy y administra tu catálogo, recibe
              pedidos y controla tus ventas desde donde estés.
            </p>
            <StoreBadges className="justify-center pt-2" />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default AppDownload;
