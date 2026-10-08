import { Coins, MessageCircle, Palette, ShoppingCart, Sparkles, Boxes } from "lucide-react";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

// ─── Showcase estilo "teléfono anotado" ──────────────────────────────────────
// iPhone mockup (CSS) con un catálogo REAL hecho en CatalogoHoy
// (MULTIPARTS.The Store, autopartes) y las funciones señaladas a los lados
// con punto+línea (desktop). En mobile: teléfono arriba y funciones en grilla.
type Callout = { icon: LucideIcon; title: string; desc: string };

const LEFT: Callout[] = [
  {
    icon: Palette,
    title: "Tu catálogo con tu marca",
    desc: "Tu logo, tus colores, tus banners y tu propio enlace.",
  },
  {
    icon: ShoppingCart,
    title: "El cliente arma su pedido solo",
    desc: "Navega, elige y llena el carrito sin que tengas que atenderlo.",
  },
  {
    icon: Coins,
    title: "Precios en dos monedas",
    desc: "Dólares y moneda local con la tasa del día, calculado solo.",
  },
];

const RIGHT: Callout[] = [
  {
    icon: MessageCircle,
    title: "La orden llega a tu WhatsApp",
    desc: "Completa, con productos, cantidades y datos del cliente.",
  },
  {
    icon: Boxes,
    title: "Stock, variantes y categorías",
    desc: "Tallas, colores y agotados bajo control, con buscador incluido.",
  },
  {
    icon: Sparkles,
    title: "Fotos y textos con IA",
    desc: "Quita el fondo de tus fotos y mejora descripciones en un clic.",
  },
];

const CalloutItem = ({ c, side, i }: { c: Callout; side: "left" | "right"; i: number }) => {
  const Icon = c.icon;
  const alignText = side === "left" ? "lg:text-right" : "lg:text-left";
  return (
    <motion.div
      initial={{ opacity: 0, x: side === "left" ? -20 : 20 }}
      whileInView={{ opacity: 1, x: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.5, delay: i * 0.1 }}
      className={`flex flex-col items-center text-center lg:items-stretch ${alignText}`}
    >
      <div className={`flex items-center justify-center gap-3 ${side === "left" ? "lg:flex-row lg:justify-end" : "lg:flex-row-reverse lg:justify-end"}`}>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-5 w-5 text-primary" strokeWidth={1.9} />
        </span>
        {/* conector punto+línea hacia el teléfono (solo desktop) */}
        <span className={`hidden items-center lg:flex ${side === "left" ? "order-last" : "order-last flex-row-reverse"}`} aria-hidden="true">
          <span className="h-px w-8 bg-border xl:w-14" />
          <span className="h-2 w-2 rounded-full bg-primary" />
        </span>
      </div>
      <h3 className="mt-3 font-display text-base font-bold text-foreground lg:text-lg">
        {c.title}
      </h3>
      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
        {c.desc}
      </p>
    </motion.div>
  );
};

const PhoneMockup = () => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.6 }}
    className="relative mx-auto w-[16.5rem] sm:w-[18.5rem]"
  >
    {/* marco del iPhone */}
    <div className="relative rounded-[2.9rem] bg-foreground p-[0.55rem] shadow-[0_35px_70px_-25px_rgba(15,23,42,0.45)]">
      {/* isla dinámica */}
      <span className="absolute left-1/2 top-[1.05rem] z-10 h-[1.35rem] w-24 -translate-x-1/2 rounded-full bg-foreground" aria-hidden="true" />
      <div className="overflow-hidden rounded-[2.35rem] bg-white">
        <picture>
          <source srcSet="/catalog-multiparts.webp" type="image/webp" />
          <img
            src="/catalog-multiparts.png"
            alt="Catálogo real creado con CatalogoHoy: MULTIPARTS.The Store, repuestos automotrices"
            width={1170}
            height={1992}
            loading="lazy"
            decoding="async"
            className="block h-auto w-full"
          />
        </picture>
      </div>
    </div>
  </motion.div>
);

const FeatureShowcase = () => {
  return (
    <section aria-labelledby="feature-showcase-heading" className="py-20 md:py-28">
      <div className="container mx-auto max-w-6xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-14 max-w-2xl text-center"
        >
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">
            Así lo ven tus clientes
          </p>
          <h2 id="feature-showcase-heading" className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-4xl">
            Una tienda real hecha con CatalogoHoy
          </h2>
          <p className="mt-4 text-lg text-muted-foreground">
            Este es el catálogo de MULTIPARTS, una tienda de autopartes que
            vende todos los días con CatalogoHoy.
          </p>
        </motion.div>

        {/* Desktop: funciones | teléfono | funciones · Mobile: teléfono y grilla */}
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[1fr_auto_1fr] lg:gap-8">
          <div className="order-2 grid gap-10 sm:grid-cols-3 lg:order-1 lg:grid-cols-1 lg:gap-16">
            {LEFT.map((c, i) => (
              <CalloutItem key={c.title} c={c} side="left" i={i} />
            ))}
          </div>

          <div className="order-1 lg:order-2">
            <PhoneMockup />
          </div>

          <div className="order-3 grid gap-10 sm:grid-cols-3 lg:grid-cols-1 lg:gap-16">
            {RIGHT.map((c, i) => (
              <CalloutItem key={c.title} c={c} side="right" i={i} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FeatureShowcase;
