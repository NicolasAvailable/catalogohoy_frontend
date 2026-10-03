import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Upload,
  Loader2,
  Download,
  ImageDown,
  Sparkles,
  RotateCcw,
  AlertCircle,
} from "lucide-react";
import {
  removeBackgroundFree,
  fileToDataUrl,
  downloadImage,
  downloadWithWhiteBg,
  SIGNUP_TOOL_URL,
} from "@/lib/remove-bg";

type Status = "idle" | "processing" | "done" | "error";

const MAX_MB = 10;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

// Fondo a cuadros para que se note la transparencia del resultado.
const CHECKER =
  "repeating-conic-gradient(#e5e7eb 0% 25%, #ffffff 0% 50%) 50% / 20px 20px";

const BgRemoverTool = () => {
  const [status, setStatus] = useState<Status>("idle");
  const [original, setOriginal] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [quotaHit, setQuotaHit] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hpRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStatus("idle");
    setOriginal(null);
    setResultUrl(null);
    setError(null);
    setQuotaHit(false);
    if (inputRef.current) inputRef.current.value = "";
  };

  const process = useCallback(async (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      setError("Formato no válido. Sube una imagen JPG, PNG o WEBP.");
      setStatus("error");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`La imagen es muy pesada. Usa una de hasta ${MAX_MB} MB.`);
      setStatus("error");
      return;
    }
    setError(null);
    setQuotaHit(false);
    setResultUrl(null);
    try {
      const dataUrl = await fileToDataUrl(file);
      setOriginal(dataUrl);
      setStatus("processing");
      const res = await removeBackgroundFree(dataUrl, hpRef.current?.value ?? "");
      if (!res.ok || !res.url) {
        setError(res.error ?? "No se pudo quitar el fondo. Inténtalo de nuevo.");
        setQuotaHit(Boolean(res.quota));
        setStatus("error");
        return;
      }
      setResultUrl(res.url);
      setRemaining(typeof res.remaining === "number" ? res.remaining : null);
      setStatus("done");
    } catch {
      setError("Algo salió mal. Inténtalo de nuevo.");
      setStatus("error");
    }
  }, []);

  const onFile = (files: FileList | null) => {
    const file = files?.[0];
    if (file) void process(file);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    onFile(e.dataTransfer.files);
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-sm">
      {/* Honeypot anti-bots (oculto). */}
      <input
        ref={hpRef}
        type="text"
        name="company_website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="sr-only"
      />

      {/* ── IDLE: dropzone ─────────────────────────────── */}
      {status === "idle" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          role="button"
          tabIndex={0}
          aria-label="Subir una foto para quitarle el fondo"
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-14 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/60 hover:bg-muted/40"
          }`}
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="h-7 w-7" />
          </span>
          <p className="mt-4 font-display text-lg font-semibold text-foreground">
            Arrastra tu foto o haz clic para subirla
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            JPG, PNG o WEBP · hasta {MAX_MB} MB · gratis, sin registro
          </p>
          <span className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground">
            Elegir foto
          </span>
        </div>
      )}

      {/* ── PROCESSING ─────────────────────────────────── */}
      {status === "processing" && (
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
          {original && (
            <img
              src={original}
              alt="Procesando tu foto"
              className="mb-6 max-h-56 rounded-lg object-contain opacity-60"
            />
          )}
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="mt-3 font-semibold text-foreground">
            Quitando el fondo con IA…
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tarda unos segundos. No cierres esta página.
          </p>
        </div>
      )}

      {/* ── DONE: antes/después + acciones ─────────────── */}
      {status === "done" && resultUrl && (
        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <figure>
              <figcaption className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Antes
              </figcaption>
              <div className="flex h-56 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/40">
                {original && (
                  <img
                    src={original}
                    alt="Foto original con fondo"
                    className="max-h-56 object-contain"
                  />
                )}
              </div>
            </figure>
            <figure>
              <figcaption className="mb-2 text-center text-xs font-semibold uppercase tracking-wide text-primary">
                Después (sin fondo)
              </figcaption>
              <div
                className="flex h-56 items-center justify-center overflow-hidden rounded-xl border border-border"
                style={{ background: CHECKER }}
              >
                <img
                  src={resultUrl}
                  alt="Foto del producto con el fondo quitado, transparente"
                  className="max-h-56 object-contain"
                />
              </div>
            </figure>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => {
                if (resultUrl)
                  downloadImage(resultUrl, "sin-fondo.png").catch(() =>
                    toast.error("No se pudo descargar. Inténtalo de nuevo.")
                  );
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Download className="h-4 w-4" /> Descargar PNG (transparente)
            </button>
            <button
              onClick={() => {
                if (resultUrl)
                  downloadWithWhiteBg(resultUrl, "fondo-blanco.jpg").catch(() =>
                    toast.error("No se pudo descargar. Inténtalo de nuevo.")
                  );
              }}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border px-5 py-2.5 font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <ImageDown className="h-4 w-4" /> Descargar con fondo blanco
            </button>
            <button
              onClick={reset}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <RotateCcw className="h-4 w-4" /> Otra foto
            </button>
          </div>

          {/* CTA de conversión (continuidad del dato). */}
          <div className="mt-5 rounded-xl border border-primary/30 bg-primary/5 p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="font-display font-semibold text-foreground">
                  Arma tu catálogo con tus fotos limpias
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Crea tu cuenta gratis y publica un catálogo profesional para
                  vender por WhatsApp e Instagram. Sin tarjeta.
                </p>
                <a
                  href={SIGNUP_TOOL_URL}
                  className="mt-3 inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Crear mi catálogo gratis
                </a>
              </div>
            </div>
          </div>

          {remaining !== null && (
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Te {remaining === 1 ? "queda" : "quedan"} {remaining}{" "}
              {remaining === 1 ? "foto gratis" : "fotos gratis"} hoy ·{" "}
              <a href={SIGNUP_TOOL_URL} className="text-primary hover:underline">
                regístrate para quitar fondos sin límite
              </a>
              .
            </p>
          )}
        </div>
      )}

      {/* ── ERROR / GATE de cuota ──────────────────────── */}
      {status === "error" && (
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <AlertCircle className="h-6 w-6" />
          </span>
          <p className="mt-4 font-semibold text-foreground">
            {quotaHit ? "Llegaste al límite gratis de hoy" : "No se pudo procesar"}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">{error}</p>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            {quotaHit ? (
              <a
                href={SIGNUP_TOOL_URL}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <Sparkles className="h-4 w-4" /> Crear cuenta gratis y seguir
              </a>
            ) : (
              <button
                onClick={reset}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-5 py-2.5 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <RotateCcw className="h-4 w-4" /> Intentar de nuevo
              </button>
            )}
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(",")}
        className="hidden"
        onChange={(e) => onFile(e.target.files)}
      />
    </div>
  );
};

export default BgRemoverTool;
