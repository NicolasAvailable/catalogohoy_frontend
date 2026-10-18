import { useEffect, useState } from "react";
import { X } from "lucide-react";
import logo from "@/assets/logo.svg";
import {
  APP_STORE_URL,
  PLAY_STORE_URL,
  AppleGlyph,
  PlayGlyph,
} from "@/components/landing/StoreLinks";

const DISMISS_KEY = "chAppBannerDismissed";

type Platform = "ios" | "android";

function detectPlatform(): Platform | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  // iPadOS reciente se identifica como Mac → distinguir por touch.
  const isIOS =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  if (isIOS) return "ios";
  if (/Android/.test(ua)) return "android";
  return null;
}

/**
 * Smart app banner (estilo "Docguía"): barra fina arriba, SOLO en móvil, que
 * detecta el sistema operativo y ofrece la descarga en la tienda que toca.
 * Descartable (se recuerda en localStorage). Empuja el navbar + contenido 3.5rem
 * vía la clase `has-app-banner` en <html> (ver index.css). En desktop no se
 * renderiza → el layout no se toca.
 */
const SmartAppBanner = () => {
  const [platform, setPlatform] = useState<Platform | null>(null);

  // Solo en cliente (evita mismatch con el HTML pre-renderizado).
  useEffect(() => {
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      /* private mode */
    }
    if (dismissed) return;
    const p = detectPlatform();
    if (p) setPlatform(p);
  }, []);

  // Mientras el banner está visible, desplaza el header + contenido.
  useEffect(() => {
    const root = document.documentElement;
    if (platform) {
      root.classList.add("has-app-banner");
      return () => root.classList.remove("has-app-banner");
    }
    return undefined;
  }, [platform]);

  if (!platform) return null;

  const isIOS = platform === "ios";
  const url = isIOS ? APP_STORE_URL : PLAY_STORE_URL;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode */
    }
    setPlatform(null);
  };

  return (
    <div className="fixed inset-x-0 top-0 z-[60] flex h-14 items-center gap-2 border-b border-border bg-white px-3">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-w-0 flex-1 items-center gap-2.5"
      >
        <img
          src={logo}
          alt=""
          aria-hidden="true"
          className="h-9 w-9 shrink-0"
        />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="truncate text-sm font-bold text-foreground">
            CatalogoHoy {isIOS ? "para iPhone" : "para Android"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            Toca para descargar gratis
          </span>
        </span>
      </a>

      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-3 py-2 text-white"
      >
        {isIOS ? <AppleGlyph className="h-4 w-4" /> : <PlayGlyph className="h-3.5 w-3.5" />}
        <span className="text-xs font-semibold tracking-tight">
          {isIOS ? "App Store" : "Google Play"}
        </span>
      </a>
    </div>
  );
};

export default SmartAppBanner;
