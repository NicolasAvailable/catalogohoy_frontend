import type { ReactNode } from "react";

export const APP_STORE_URL =
  "https://apps.apple.com/us/app/catalogohoy-cat%C3%A1logo-y-ventas/id6817059692?l=es-MX";
export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.catalogohoy.app";

// Logos monocromos (blanco) para los badges oscuros estilo tienda oficial.
export const AppleGlyph = ({ className = "h-7 w-7" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701z" />
  </svg>
);

// Google Play con sus colores oficiales (azul/rojo/verde/amarillo).
export const PlayGlyph = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <path fill="#2196F3" d="M1.337.924a1.486 1.486 0 0 0-.112.568v21.017c0 .217.045.419.124.6l11.155-11.087L1.337.924z" />
    <path fill="#F44336" d="M13.544 10.989l3.258-3.238L3.45.195a1.466 1.466 0 0 0-.946-.179l11.04 10.973z" />
    <path fill="#4CAF50" d="M13.544 13.056l-11 10.933c.298.036.612-.016.906-.183l13.324-7.54-3.23-3.21z" />
    <path fill="#FFC107" d="M22.018 13.298l-3.919 2.218-3.515-3.493 3.543-3.521 3.891 2.202a1.49 1.49 0 0 1 0 2.594z" />
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

/** Badges reutilizables (p.ej. el footer). */
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
