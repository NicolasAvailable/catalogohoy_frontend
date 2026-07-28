import { Store, User, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useId, type ReactNode } from "react";

// ─── Glyphs de marca (inline) ────────────────────────────────────────────────
const WhatsAppGlyph = ({ className = "h-6 w-6" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="#25D366" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884M20.463 3.488A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

const InstagramGlyph = () => {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#f58529" />
          <stop offset="0.35" stopColor="#dd2a7b" />
          <stop offset="0.7" stopColor="#8134af" />
          <stop offset="1" stopColor="#515bd4" />
        </linearGradient>
      </defs>
      <path fill={`url(#${id})`} d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
    </svg>
  );
};

const FacebookGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#1877F2" aria-hidden="true">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const TikTokGlyph = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" fill="#010101" aria-hidden="true">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.08-.14 1.62.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

// WhatsApp Business: logo oficial (descargado a public/whatsapp-business.svg).
const WhatsAppBusinessGlyph = () => (
  <img
    src="/whatsapp-business.svg"
    alt=""
    aria-hidden="true"
    className="h-[1.45rem] w-[1.45rem]"
  />
);

// ─── Diagrama del flujo real ─────────────────────────────────────────────────
// Cliente → Tu tienda → Orden en WhatsApp → Canales de atención (IG/FB/TikTok).
const CLIENTE = { x: 8, y: 44 };
const HUB = { x: 30, y: 44 };
const WHATSAPP = { x: 56, y: 44 };
const PRODUCTOS = [
  { x: 24, y: 78, grad: "from-primary-100 to-primary-200", emoji: "👕" },
  { x: 37, y: 78, grad: "from-violet-200 to-violet-300", emoji: "👟" },
];
const CANALES: { x: number; y: number; glyph: ReactNode; label: string }[] = [
  { x: 88, y: 10, glyph: <WhatsAppBusinessGlyph />, label: "WhatsApp Business" },
  { x: 88, y: 30, glyph: <FacebookGlyph />, label: "Facebook" },
  { x: 88, y: 50, glyph: <InstagramGlyph />, label: "Instagram" },
  { x: 88, y: 70, glyph: <TikTokGlyph />, label: "TikTok" },
];

const FlowDiagram = () => (
  <div className="relative mx-auto w-full max-w-3xl rounded-3xl border border-border/70 bg-gradient-to-b from-secondary/50 to-white shadow-[0_30px_60px_-25px_rgba(0,0,0,0.18)] p-6 sm:p-8">
    <div className="relative hidden h-[24rem] sm:block">
      {/* Líneas + puntos de flujo (detrás de los nodos) */}
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        {/* espina: cliente → tienda */}
        <line x1={CLIENTE.x} y1={CLIENTE.y} x2={HUB.x} y2={HUB.y} stroke="hsl(var(--border))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        {/* espina: tienda → whatsapp (la orden, verde) */}
        <line x1={HUB.x} y1={HUB.y} x2={WHATSAPP.x} y2={WHATSAPP.y} stroke="#25D366" strokeOpacity="0.6" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {/* tienda → productos */}
        {PRODUCTOS.map((p, i) => (
          <line key={`lp-${i}`} x1={HUB.x} y1={HUB.y} x2={p.x} y2={p.y} stroke="hsl(var(--border))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        ))}
        {/* whatsapp → canales de atención */}
        {CANALES.map((c, i) => (
          <line key={`lc-${i}`} x1={WHATSAPP.x} y1={WHATSAPP.y} x2={c.x} y2={c.y} stroke="hsl(var(--border))" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        ))}

        {/* punto verde: el pedido viaja cliente → tienda → whatsapp */}
        <motion.circle r="1.5" fill="#25D366"
          animate={{ cx: [CLIENTE.x, HUB.x, WHATSAPP.x], cy: [CLIENTE.y, HUB.y, WHATSAPP.y], opacity: [0, 1, 1, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }} />
        {/* puntos: whatsapp → canales (atención) */}
        {CANALES.map((c, i) => (
          <motion.circle key={`fc-${i}`} r="1.1" fill="hsl(var(--primary))"
            animate={{ cx: [WHATSAPP.x, c.x], cy: [WHATSAPP.y, c.y], opacity: [0, 1, 1, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear", delay: i * 0.6 }} />
        ))}
      </svg>

      {/* Cliente */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${CLIENTE.x}%`, top: `${CLIENTE.y}%` }}>
        <div className="relative flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border/70 bg-white shadow-md">
            <User className="h-6 w-6 text-muted-foreground" strokeWidth={1.8} />
          </div>
          <span className="absolute top-full mt-2 whitespace-nowrap text-[0.7rem] font-semibold text-muted-foreground">Cliente</span>
        </div>
      </div>

      {/* Tu tienda (hub) */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${HUB.x}%`, top: `${HUB.y}%` }}>
        <div className="relative flex flex-col items-center">
          <div className="relative">
            <motion.span aria-hidden="true" className="absolute inset-0 rounded-2xl bg-primary/30"
              animate={{ scale: [1, 1.6], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }} />
            <div className="relative flex h-[4.75rem] w-[4.75rem] items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
              <Store className="h-8 w-8" strokeWidth={1.7} />
            </div>
          </div>
          <span className="absolute top-full mt-2 whitespace-nowrap text-xs font-bold text-foreground">Tu catálogo</span>
        </div>
      </div>

      {/* Productos (contenido de tu tienda) */}
      {PRODUCTOS.map((p, i) => (
        <div key={`p-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.x}%`, top: `${p.y}%` }}>
          <div className={`flex h-11 w-11 items-center justify-center rounded-xl border border-border/60 bg-gradient-to-br ${p.grad} text-lg shadow-md`}>
            <span aria-hidden="true">{p.emoji}</span>
          </div>
        </div>
      ))}
      <span className="absolute -translate-x-1/2 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70" style={{ left: "30%", top: "92%" }}>
        Tus productos
      </span>

      {/* WhatsApp — llega la orden (destacado) */}
      <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${WHATSAPP.x}%`, top: `${WHATSAPP.y}%` }} aria-label="WhatsApp — la orden">
        <div className="relative">
          <motion.span aria-hidden="true" className="absolute inset-0 rounded-full bg-emerald-400/40"
            animate={{ scale: [1, 1.7], opacity: [0.5, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }} />
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-emerald-200 bg-white shadow-lg">
            <WhatsAppGlyph className="h-8 w-8" />
          </div>
        </div>
      </div>
      <span className="absolute -translate-x-1/2 whitespace-nowrap rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.65rem] font-bold text-emerald-600" style={{ left: `${WHATSAPP.x}%`, top: "22%" }}>
        La orden llega acá
      </span>

      {/* Canales de atención */}
      {CANALES.map((c, i) => (
        <div key={`c-${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${c.x}%`, top: `${c.y}%` }} aria-label={c.label}>
          <div className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-white shadow-md">
            {c.glyph}
          </div>
        </div>
      ))}
      <span className="absolute right-0 whitespace-nowrap text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70" style={{ top: "1%" }}>
        Canales de venta
      </span>
    </div>

    {/* ── Mobile: flujo vertical (el horizontal no entra en pantallas chicas) ── */}
    <div className="flex flex-col items-center gap-2 sm:hidden">
      {/* Cliente */}
      <div className="flex flex-col items-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-border/70 bg-white shadow-md">
          <User className="h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
        </div>
        <span className="mt-1 text-[0.7rem] font-semibold text-muted-foreground">Cliente</span>
      </div>
      <div className="h-4 w-px bg-border" />

      {/* Tu catálogo + productos */}
      <div className="flex flex-col items-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
          <Store className="h-7 w-7" strokeWidth={1.7} />
        </div>
        <span className="mt-1 text-xs font-bold text-foreground">Tu catálogo</span>
        <div className="mt-2 flex gap-1.5">
          {PRODUCTOS.map((p, i) => (
            <span
              key={`mp-${i}`}
              className={`flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-gradient-to-br ${p.grad} text-sm`}
            >
              {p.emoji}
            </span>
          ))}
        </div>
      </div>
      <div className="h-4 w-px bg-border" />

      {/* WhatsApp — la orden */}
      <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[0.65rem] font-bold text-emerald-600">
        La orden llega acá
      </span>
      <div className="flex h-14 w-14 items-center justify-center rounded-full border border-emerald-200 bg-white shadow-lg">
        <WhatsAppGlyph className="h-7 w-7" />
      </div>
      <div className="h-4 w-px bg-border" />

      {/* Canales de venta */}
      <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground/70">
        Canales de venta
      </span>
      <div className="mt-1 flex items-center gap-3">
        {CANALES.map((c, i) => (
          <div
            key={`mc-${i}`}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 bg-white shadow-md"
            aria-label={c.label}
          >
            {c.glyph}
          </div>
        ))}
      </div>
    </div>
  </div>
);

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

const HowItWorks = () => {
  return (
    <section id="how-it-works" aria-labelledby="how-it-works-heading" className="bg-white py-24 md:py-32">
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
            Cómo funciona
          </p>
          <h2 id="how-it-works-heading" className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-4xl lg:text-5xl">
            De tu catálogo a tus clientes,
            <br />
            <span className="text-primary">todo en un mismo lugar</span>
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Tu cliente entra a tu tienda y hace su pedido. La orden te llega a
            WhatsApp y atiendes desde todos tus canales, sin cambiar de app.
          </p>
        </motion.div>

        {/* Diagrama */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.6 }}
        >
          <FlowDiagram />
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
