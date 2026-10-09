import { ArrowRight, Play } from "lucide-react";
import { motion } from "framer-motion";
import { useRef, useState } from "react";

// ─── Demo en video ───────────────────────────────────────────────────────────
// Reemplaza al antiguo diagrama de flujo. El video es el corte 1:45-2:26 del
// master (41 s, ~1.2 MB), así que
// NO se descarga nada hasta que el visitante le da play: preload="none" +
// poster webp (48 kB). Los controles nativos aparecen recién al reproducir.
// SEO: schema.org VideoObject en index.html apunta a estos mismos archivos.
const DemoVideo = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  return (
    <div className="relative mx-auto w-full max-w-4xl overflow-hidden rounded-3xl border border-border/70 bg-foreground shadow-[0_30px_60px_-25px_rgba(0,0,0,0.3)]">
      <video
        ref={videoRef}
        className="block h-auto w-full"
        poster="/demo-poster.webp"
        preload="none"
        playsInline
        controls={playing}
        width={1440}
        height={914}
        onPlay={() => setPlaying(true)}
        aria-label="Demo de CatalogoHoy"
      >
        <source src="/demo-catalogohoy.mp4" type="video/mp4" />
        Tu navegador no soporta video HTML5.
      </video>

      {!playing && (
        <button
          type="button"
          onClick={() => videoRef.current?.play()}
          aria-label="Ver la demo (41 segundos)"
          className="group absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/15 transition-colors hover:bg-black/25"
        >
          <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary shadow-xl shadow-primary/40 transition-transform group-hover:scale-110">
            <Play className="ml-1 h-9 w-9 text-primary-foreground" fill="currentColor" strokeWidth={0} />
          </span>
          <span className="rounded-full bg-black/55 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
            Ver la demo · 0:41
          </span>
        </button>
      )}
    </div>
  );
};

// ─── Sección ─────────────────────────────────────────────────────────────────
const steps = [
  {
    n: 1,
    title: "Crea tu catálogo",
    desc: "Sube tus productos y personalízalo con tu logo, colores y tu propio enlace.",
  },
  {
    n: 2,
    title: "Comparte tu link",
    desc: "Publica tu tienda en tus redes. Tus clientes la abren y arman su pedido solos.",
  },
  {
    n: 3,
    title: "Recibe y atiende",
    desc: "La orden te llega a tu WhatsApp y a tu panel, y atiendes a tu cliente en un solo lugar.",
  },
];

const HowItWorks = ({ embedded = false }: { embedded?: boolean }) => {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className={`py-24 md:py-32 ${embedded ? "" : "bg-white"}`}>
      <div className="container mx-auto max-w-6xl px-6">
        {/* Encabezado */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-16 max-w-2xl text-center"
        >
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">
            Demo
          </p>
          <h2 id="how-it-works-heading" className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-4xl lg:text-5xl">
            De tu catálogo a tus clientes,
            <br />
            <span className="text-primary">todo en un mismo lugar</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Mira en 41 segundos cómo creas tu catálogo, lo compartes y
            recibes pedidos por WhatsApp — tal cual lo vas a usar.
          </p>
        </motion.div>

        {/* Demo en video */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <DemoVideo />
        </motion.div>

        {/* Pasos */}
        <div className="mx-auto mt-16 grid max-w-4xl gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: s.n * 0.08 }}
              className="text-center sm:text-left"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-extrabold text-primary">
                {s.n}
              </span>
              <h3 className="mt-3 font-display text-lg font-bold text-foreground">
                {s.title}
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                {s.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12 flex justify-center">
          <a
            href="https://auth.catalogohoy.com/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3.5 text-base font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:bg-primary-700"
          >
            Crea tu catálogo gratis
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
