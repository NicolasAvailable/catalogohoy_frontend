import {
  ArrowRight,
  Store,
  ClipboardCheck,
  RefreshCw,
  BadgePercent,
  Check,
  type LucideIcon,
} from "lucide-react";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useVisitorCountry, isVenezuela } from "@/hooks/use-visitor-country";

// ─── Mockups (reconstruidos en JSX para que queden nítidos) ──────────────────

/** Marco de iPhone reutilizable con una captura real dentro. */
const PhoneMockup = ({ src, alt }: { src: string; alt: string }) => (
  <div className="relative mx-auto w-[252px]">
    {/* Glow de color detrás del teléfono */}
    <div
      aria-hidden="true"
      className="absolute -inset-8 rounded-[3.5rem] bg-gradient-to-tr from-primary/25 via-violet-300/20 to-transparent blur-3xl"
    />

    {/* Cuerpo del iPhone (rim de titanio) */}
    <div className="relative rounded-[3rem] bg-gradient-to-b from-neutral-500 via-neutral-800 to-neutral-700 p-[3px] shadow-[0_45px_90px_-25px_rgba(24,32,51,0.55)]">
      {/* Botones laterales */}
      <div className="absolute -left-[3px] top-[18%] h-8 w-[3px] rounded-l bg-neutral-700" aria-hidden="true" />
      <div className="absolute -left-[3px] top-[30%] h-12 w-[3px] rounded-l bg-neutral-700" aria-hidden="true" />
      <div className="absolute -left-[3px] top-[44%] h-12 w-[3px] rounded-l bg-neutral-700" aria-hidden="true" />
      <div className="absolute -right-[3px] top-[34%] h-16 w-[3px] rounded-r bg-neutral-700" aria-hidden="true" />

      {/* Marco negro interior */}
      <div className="relative rounded-[2.85rem] bg-neutral-950 p-[7px]">
        {/* Dynamic island */}
        <div className="absolute left-1/2 top-[0.85rem] z-20 h-[1.15rem] w-[4.75rem] -translate-x-1/2 rounded-full bg-black shadow-inner" />

        {/* Pantalla */}
        <div className="relative overflow-hidden rounded-[2.35rem] bg-white">
          {/* Barra de estado (para que el notch no tape el contenido) */}
          <div className="h-7 w-full bg-white" aria-hidden="true" />
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="block w-full select-none"
            draggable={false}
          />
          {/* Brillo diagonal sutil sobre la pantalla */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-white/25"
          />
        </div>
      </div>
    </div>
  </div>
);

/** Vitrina: catálogo real (multiparts) en un iPhone. */
const CatalogMockup = () => (
  <PhoneMockup
    src="/catalog-multiparts.png"
    alt="Catálogo real de una tienda en CatalogoHoy, visto desde el celular"
  />
);

/** Marca de WhatsApp (inline). */
const Wa = ({ className = "h-4 w-4" }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.71.306 1.263.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.999-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884M20.463 3.488A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);

/** Pedido recibido: la vista del comerciante + aviso de WhatsApp. */
const OrderMockup = () => {
  const items = [
    { emoji: "👕", name: "Franela Oversize", meta: "Talla M · Azul", qty: 2, price: "$36,00" },
    { emoji: "🧢", name: "Gorra Urban", meta: "Negra", qty: 1, price: "$12,00" },
  ];
  return (
    <div className="relative mx-auto max-w-sm">
      {/* Notificación de WhatsApp flotante */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="absolute -top-8 -right-2 z-10 flex items-center gap-2.5 rounded-2xl border border-border/60 bg-white px-3.5 py-2.5 shadow-xl shadow-emerald-500/10"
      >
        <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Wa className="h-5 w-5" />
          <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-red-500" />
        </span>
        <div>
          <p className="text-xs font-bold text-foreground">Nuevo pedido</p>
          <p className="text-[0.65rem] text-muted-foreground">Te llegó por WhatsApp</p>
        </div>
      </motion.div>

      {/* Tarjeta del pedido (panel) */}
      <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-xl shadow-primary/5">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-700 text-sm font-bold text-white">
              MG
            </span>
            <div>
              <p className="font-display text-sm font-bold text-foreground">Pedido #1042</p>
              <p className="text-xs text-muted-foreground">María González</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[0.65rem] font-semibold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Recibido
          </span>
        </div>

        <div className="space-y-2.5">
          {items.map((it) => (
            <div key={it.name} className="flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-base">
                {it.emoji}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{it.name}</p>
                <p className="text-[0.65rem] text-muted-foreground">{it.meta}</p>
              </div>
              <span className="text-[0.65rem] text-muted-foreground">x{it.qty}</span>
              <span className="text-xs font-semibold text-foreground">{it.price}</span>
            </div>
          ))}
        </div>

        <div className="my-3 border-t border-border/70" />

        <div className="space-y-1 text-[0.7rem] text-muted-foreground">
          <p>📍 Av. Principal, Caracas</p>
          <p>🛵 Entrega: mañana, 10–12 h</p>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Total</span>
          <span className="font-display text-lg font-extrabold text-foreground">$48,00</span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="flex h-10 items-center justify-center rounded-xl border border-border text-xs font-semibold text-foreground">
            Ver en panel
          </div>
          <div className="flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-500 text-xs font-semibold text-white">
            <Wa className="h-4 w-4" />
            Responder
          </div>
        </div>
      </div>
    </div>
  );
};

/** Precio multimoneda con tasa del día automática. */
const RateMockup = () => (
  <div className="rounded-2xl border border-border/70 bg-white p-5 shadow-xl shadow-primary/5">
    <div className="flex items-center gap-3">
      <div className="h-14 w-14 shrink-0 rounded-xl bg-gradient-to-br from-primary-100 to-primary-200" />
      <div>
        <p className="font-display text-sm font-bold text-foreground">
          Sneakers Retro
        </p>
        <p className="text-xs text-muted-foreground">Edición limitada</p>
      </div>
    </div>
    <div className="mt-4 flex items-end justify-between">
      <div>
        <p className="font-display text-2xl font-extrabold text-foreground">
          $45,00
        </p>
        <p className="text-sm font-semibold text-muted-foreground">
          Bs 5.737,50
        </p>
      </div>
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary px-3 py-1.5 text-[0.7rem] font-semibold text-foreground">
        <RefreshCw className="h-3.5 w-3.5 text-primary" />
        Tasa BCV hoy · 127,50
      </span>
    </div>
    <p className="mt-3 text-[0.7rem] text-muted-foreground">
      Se actualiza sola cada día. Vos cargás en $, tu cliente ve su moneda.
    </p>
  </div>
);

/** Sin comisiones: resumen de venta con 0% de comisión (fuera de Venezuela). */
const NoCommissionMockup = () => (
  <div className="rounded-2xl border border-border/70 bg-white p-6 shadow-xl shadow-primary/5">
    <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      Resumen de tu venta
    </p>
    <div className="space-y-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Venta</span>
        <span className="font-semibold text-foreground">$48,00</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground">Comisión CatalogoHoy</span>
        <span className="inline-flex items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-600">
            0%
          </span>
          <span className="font-semibold text-foreground">$0,00</span>
        </span>
      </div>
    </div>
    <div className="my-4 border-t border-border/70" />
    <div className="flex items-end justify-between">
      <span className="text-sm font-bold text-foreground">Recibes</span>
      <span className="font-display text-2xl font-extrabold text-foreground">$48,00</span>
    </div>
    <p className="mt-3 text-[0.7rem] text-muted-foreground">
      Solo pagas tu plan mensual. Vende sin límite de pedidos.
    </p>
  </div>
);

// ─── Filas de feature (patrón alternado estilo post-bridge) ──────────────────

type Row = {
  id: string;
  eyebrow: string;
  icon: LucideIcon;
  title: ReactNode;
  description: string;
  bullets: string[];
  primary: { label: string; href: string };
  secondary: { label: string; href: string };
  visual: ReactNode;
  reverse?: boolean;
};

const baseRows: Row[] = [
  {
    id: "catalogo",
    eyebrow: "Catálogo autogestionable",
    icon: Store,
    title: (
      <>
        Tu tienda online,
        <br />
        <span className="text-primary">lista para vender</span>
      </>
    ),
    description:
      "Tu cliente navega, elige y arma su pedido solo — como en un ecommerce real, sin el costo ni la complejidad. Personaliza colores, logo y tu propio enlace.",
    bullets: [
      "Link con tu marca, no una plataforma genérica",
      "Categorías y buscador para encontrar todo rápido",
      "Cambios en tiempo real, sin esperas",
    ],
    primary: { label: "Comenzar gratis", href: "https://auth.catalogohoy.com/signup" },
    secondary: { label: "Ver funciones", href: "#how-it-works" },
    visual: <CatalogMockup />,
  },
  {
    id: "pedidos",
    eyebrow: "Pedidos por WhatsApp",
    icon: ClipboardCheck,
    title: (
      <>
        Recibe pedidos completos,
        <br />
        <span className="text-primary">listos para despachar</span>
      </>
    ),
    description:
      "Cuando el cliente confirma, te llega el pedido entero: productos, cantidades y datos. Todo en tu panel y en tu WhatsApp, sin ida y vuelta de mensajes.",
    bullets: [
      "Nada de anotar pedidos a mano",
      "Notificaciones al instante por WhatsApp",
      "Historial y estado de cada pedido",
    ],
    primary: { label: "Comenzar gratis", href: "https://auth.catalogohoy.com/signup" },
    secondary: { label: "Ver planes", href: "#pricing" },
    visual: <OrderMockup />,
    reverse: true,
  },
];

/** Tercera fila — solo Venezuela: tasas del día (BCV / Bs). */
const tasasRow: Row = {
  id: "tasas",
  eyebrow: "Tasas del día automáticas",
  icon: RefreshCw,
  title: (
    <>
      Precios siempre al día,
      <br />
      <span className="text-primary">sin que calcules nada</span>
    </>
  ),
  description:
    "Cargas tus precios en dólares y cada cliente ve el monto en su moneda, con la tasa del día actualizada sola. Sin errores, sin editar producto por producto.",
  bullets: [
    "Tasa BCV actualizada automáticamente",
    "El cliente elige en qué moneda ver los precios",
    "Cero cálculos manuales",
  ],
  primary: { label: "Comenzar gratis", href: "https://auth.catalogohoy.com/signup" },
  secondary: { label: "Ver planes", href: "#pricing" },
  visual: <RateMockup />,
};

/** Tercera fila — fuera de Venezuela: sin comisiones por venta. */
const noCommissionRow: Row = {
  id: "sin-comision",
  eyebrow: "Sin comisiones",
  icon: BadgePercent,
  title: (
    <>
      Cada venta
      <br />
      <span className="text-primary">es 100% tuya</span>
    </>
  ),
  description:
    "No te cobramos comisión por tus pedidos. Pagas tu plan mensual y listo — lo que vendes queda para ti, sin descuentos por transacción.",
  bullets: [
    "0% de comisión por venta",
    "Pedidos ilimitados en tu WhatsApp",
    "Sin sorpresas en tu factura",
  ],
  primary: { label: "Comenzar gratis", href: "https://auth.catalogohoy.com/signup" },
  secondary: { label: "Ver planes", href: "#pricing" },
  visual: <NoCommissionMockup />,
};

const FeatureRow = ({ row }: { row: Row }) => {
  const Icon = row.icon;
  return (
    <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
      {/* Texto */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6 }}
        className={row.reverse ? "lg:order-2" : ""}
      >
        <div className="mb-5 inline-flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="text-sm font-bold uppercase tracking-wider text-primary">
            {row.eyebrow}
          </span>
        </div>

        <h3 className="font-display text-3xl font-extrabold leading-[1.12] tracking-tight text-foreground md:text-4xl lg:text-[2.75rem]">
          {row.title}
        </h3>

        <p className="mt-5 max-w-lg text-base leading-relaxed text-muted-foreground md:text-lg">
          {row.description}
        </p>

        <ul className="mt-6 space-y-2.5">
          {row.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-sm text-foreground">{b}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <a
            href={row.primary.href}
            target={row.primary.href.startsWith("http") ? "_blank" : undefined}
            rel={row.primary.href.startsWith("http") ? "noopener noreferrer" : undefined}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-105 hover:bg-primary-700"
          >
            {row.primary.label}
            <ArrowRight className="h-4 w-4" />
          </a>
          <a
            href={row.secondary.href}
            className="inline-flex items-center justify-center rounded-xl border border-border bg-white px-6 py-3 text-sm font-semibold text-foreground transition-colors hover:bg-muted"
          >
            {row.secondary.label}
          </a>
        </div>
      </motion.div>

      {/* Visual */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true, margin: "-100px" }}
        transition={{ duration: 0.6, delay: 0.1 }}
        className={row.reverse ? "lg:order-1" : ""}
      >
        <div className="rounded-3xl border border-border/60 bg-gradient-to-b from-secondary/50 to-white p-6 sm:p-8">
          {row.visual}
        </div>
      </motion.div>
    </div>
  );
};

const Features = () => {
  // La feature de "tasas del día" (BCV/Bs) es solo de Venezuela. Fuera de VE
  // (o si no podemos detectar el país) mostramos "sin comisiones" en su lugar.
  const { country } = useVisitorCountry();
  const rows = [...baseRows, isVenezuela(country) ? tasasRow : noCommissionRow];

  return (
    <section id="features" aria-labelledby="features-heading" className="bg-white py-24 md:py-32">
      <div className="container mx-auto max-w-6xl px-6">
        {/* Encabezado de sección */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mx-auto mb-20 max-w-2xl text-center"
        >
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-primary">
            Qué incluye
          </p>
          <h2
            id="features-heading"
            className="font-display text-3xl font-extrabold leading-tight tracking-tight text-foreground md:text-4xl lg:text-5xl"
          >
            Todo lo que tu tienda necesita.
            <br />
            <span className="text-primary">Desde el primer día.</span>
          </h2>
        </motion.div>

        {/* Filas alternadas */}
        <div className="space-y-24 md:space-y-32">
          {rows.map((row) => (
            <FeatureRow key={row.id} row={row} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
