import {
  Store,
  LayoutGrid,
  ClipboardCheck,
  TrendingUp,
  Globe,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

const features = [
  {
    icon: Store,
    title: "Catálogo autogestionable",
    description:
      "Tu cliente navega, elige y pide sin que tú tengas que responder nada. Como un ecommerce real, sin el costo ni la complejidad.",
  },
  {
    icon: ClipboardCheck,
    title: "Pedidos organizados",
    description:
      "Cuando el cliente confirma, te llega el pedido completo: productos, cantidades y datos. Todo en tu panel, listo para despachar.",
  },
  {
    icon: TrendingUp,
    title: "Tasas del día automáticas",
    description:
      "Tus precios en dólares, los montos en la moneda que el cliente elija. Actualización automática, sin errores, sin que tú calcules nada.",
  },
  {
    icon: LayoutGrid,
    title: "Categorías y organización",
    description:
      "Clasifica tus productos en categorías para que tus clientes encuentren lo que buscan al instante.",
  },
  {
    icon: Globe,
    title: "Tu catálogo, tu marca",
    description:
      "Colores, logo y enlace con tu nombre. Tu cliente ve tu tienda, no una plataforma genérica. Profesionalismo desde el día 1.",
  },
  {
    icon: Zap,
    title: "Edición en tiempo real",
    description:
      "Edita productos, precios o categorías y los cambios se reflejan al instante en tu catálogo. Sin esperas.",
  },
];

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" as const },
  },
};

const Features = () => {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="py-24 md:py-32"
      style={{
        background:
          "linear-gradient(180deg, #f8faff 0%, #eef4ff 50%, #f8faff 100%)",
      }}
    >
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            Qué incluye
          </p>
          <h2
            id="features-heading"
            className="font-display font-extrabold text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight"
          >
            Todo incluido.
            <br />
            <span className="text-primary">Desde el primer día.</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl">
            Herramientas pensadas para facilitar la gestión de tu tienda y
            atraer más clientes.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {features.map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="group rounded-2xl border border-border/60 bg-white p-7 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 hover:-translate-y-1.5"
            >
              <div
                className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-5 group-hover:scale-110 transition-transform duration-300"
              >
                <feature.icon className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <h3 className="font-display font-bold text-lg text-foreground mb-2">
                {feature.title}
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                {feature.description}
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default Features;
