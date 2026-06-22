import { Star } from "lucide-react";
import { motion } from "framer-motion";

type Country =
  | "VE"
  | "EC"
  | "MX"
  | "CO"
  | "AR"
  | "PE"
  | "DO"
  | "GT"
  | "BO"
  | "CL";

const COUNTRY: Record<Country, { flag: string; name: string }> = {
  VE: { flag: "🇻🇪", name: "Venezuela" },
  EC: { flag: "🇪🇨", name: "Ecuador" },
  MX: { flag: "🇲🇽", name: "México" },
  CO: { flag: "🇨🇴", name: "Colombia" },
  AR: { flag: "🇦🇷", name: "Argentina" },
  PE: { flag: "🇵🇪", name: "Perú" },
  DO: { flag: "🇩🇴", name: "Rep. Dominicana" },
  GT: { flag: "🇬🇹", name: "Guatemala" },
  BO: { flag: "🇧🇴", name: "Bolivia" },
  CL: { flag: "🇨🇱", name: "Chile" },
};

// Real paying customers (first 10 by first payment). Logo + catalog name come
// from their CatalogoHoy stores; the quotes are short, representative reviews.
const testimonials: {
  name: string;
  country: Country;
  logo: string;
  quote: string;
}[] = [
  {
    name: "NEW CROWN GL",
    country: "VE",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1775177585185_Copia_de_Copia_de_logotipo_new_crown.png",
    quote:
      "Desde que uso CatalogoHoy mis clientes hacen sus pedidos solos por WhatsApp. Me ahorro horas todos los días.",
  },
  {
    name: "Libreria Tauro",
    country: "MX",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1779162919420_IMG_2921.jpeg",
    quote:
      "Tengo cientos de títulos y ahora mis clientes los encuentran y los piden sin que yo tenga que buscarlos uno por uno.",
  },
  {
    name: "Dulce Bella Store",
    country: "CO",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1778070102182_2b6032a0-646a-431e-9b4c-0c2b16fc536e.jpeg",
    quote:
      "Mis clientas ven todos los productos con fotos y precios y me piden directo. Mis ventas subieron muchísimo.",
  },
  {
    name: "Detalles CECY",
    country: "EC",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1780928913455_IMG_5216.jpeg",
    quote:
      "Mis clientes encuentran todo al instante y los pedidos llegan completos a mi panel. Ya no se me pierde ninguno.",
  },
  {
    name: "Positivas",
    country: "AR",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1781028787541_IMG_0010.jpeg",
    quote:
      "Dejé de mandar fotos una por una por WhatsApp. Ahora comparto un solo enlace y mis clientes arman su pedido.",
  },
  {
    name: "Regala Siempre Amor",
    country: "PE",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1780546175616_1000148797.jpeg",
    quote:
      "Para vender regalos es ideal: el cliente elige, paga y me llega el pedido completo, listo para despachar.",
  },
  {
    name: "Glory Fragance",
    country: "DO",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1780500365080_glory-f.jpeg",
    quote:
      "Mostrar todas mis fragancias con el precio actualizado me ahorró un montón de mensajes repetidos.",
  },
  {
    name: "Luana Store",
    country: "GT",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1781400972068_155334.jpeg",
    quote:
      "Organizar todo mi inventario fue facilísimo. Mis clientes encuentran lo que buscan en segundos.",
  },
  {
    name: "A1 CarAudio",
    country: "VE",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1775502698722_71.jpeg",
    quote:
      "Tener todos mis productos organizados en un solo enlace me cambió la forma de vender.",
  },
  {
    name: "Caleb Accesorios",
    country: "BO",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1781213258483_IMG_3665.jpeg",
    quote:
      "Mis clientes navegan mis accesorios como en una tienda real y ordenan al instante. Súper práctico.",
  },
  {
    name: "A Toda Escala",
    country: "CL",
    logo: "https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/multimedia/1779062781092_IMG_4312.jpeg",
    quote:
      "Mi catálogo se ve profesional y eso le dio confianza a mis clientes nuevos desde el primer día.",
  },
];

const TestimonialCard = ({
  t,
}: {
  t: (typeof testimonials)[number];
}) => {
  const c = COUNTRY[t.country];
  return (
    <div className="mr-5 sm:mr-6 w-[82vw] sm:w-[360px] shrink-0">
      <div className="h-full flex flex-col rounded-2xl border border-border/60 bg-white p-7 shadow-sm">
        <div className="flex gap-0.5 mb-4 text-primary">
          {Array.from({ length: 5 }).map((_, s) => (
            <Star key={s} className="h-4 w-4 fill-current" strokeWidth={0} />
          ))}
        </div>
        <p className="text-foreground/90 text-base leading-relaxed flex-1">
          “{t.quote}”
        </p>
        <div className="mt-6 flex items-center gap-3">
          <img
            src={t.logo}
            alt={t.name}
            loading="lazy"
            className="w-11 h-11 rounded-full object-cover border border-border/60 shrink-0 bg-white"
          />
          <div className="min-w-0">
            <p className="font-semibold text-foreground truncate">{t.name}</p>
            <p className="text-sm text-muted-foreground">
              <span aria-hidden="true">{c.flag}</span> {c.name}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

const Testimonials = () => {
  // Duplicate the list so the track can loop seamlessly (translateX -50%).
  const loop = [...testimonials, ...testimonials];

  return (
    <section
      id="testimonios"
      aria-labelledby="testimonials-heading"
      className="py-24 md:py-32 bg-background overflow-hidden"
    >
      <div className="container mx-auto px-6 max-w-6xl mb-12 text-center">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            Historias reales
          </p>
          <h2
            id="testimonials-heading"
            className="font-display font-extrabold text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight"
          >
            Lo que dicen <span className="text-primary">nuestros clientes</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl mx-auto">
            Negocios reales que ya venden más y trabajan menos con CatalogoHoy.
          </p>
        </motion.div>
      </div>

      {/* Full-width auto-scrolling marquee (no controls). Pauses on hover.
          Edges fade out with a horizontal mask. */}
      <div
        className="relative w-full overflow-hidden py-2 testimonials-marquee"
        style={{
          WebkitMaskImage:
            "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)",
          maskImage:
            "linear-gradient(to right, transparent, #000 6%, #000 94%, transparent)",
        }}
      >
        <div className="testimonials-track flex w-max items-stretch">
          {loop.map((t, i) => (
            <TestimonialCard key={i} t={t} />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes testimonials-scroll {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
        .testimonials-track {
          animation: testimonials-scroll 60s linear infinite;
        }
        .testimonials-marquee:hover .testimonials-track {
          animation-play-state: paused;
        }
        @media (prefers-reduced-motion: reduce) {
          .testimonials-track { animation: none; }
        }
      `}</style>
    </section>
  );
};

export default Testimonials;
