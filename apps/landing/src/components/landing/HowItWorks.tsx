import { motion } from "framer-motion";
import { ArrowRight, Smartphone, Share2, BarChart3 } from "lucide-react";

type Step = {
  number: number;
  title: string;
  description: string;
  cta: { label: string; href: string };
  icon: typeof Smartphone;
  bg: string;
};

const steps: Step[] = [
  {
    number: 1,
    title: "Crea tu Catálogo Interactivo",
    description:
      "Sube tus productos, personaliza tu catálogo y comparte el link en tus redes para empezar a recibir pedidos hoy mismo.",
    cta: { label: "Crea un catálogo para tu negocio", href: "https://auth.catalogohoy.com/signup" },
    icon: Smartphone,
    bg: "linear-gradient(135deg, #6366f1 0%, #818cf8 100%)",
  },
  {
    number: 2,
    title: "Comparte tu link",
    description:
      "Tus clientes hacen su pedido completo en tu catálogo interactivo. Tú lo recibes directo por WhatsApp, listo para preparar.",
    cta: { label: "Comparte por WhatsApp e Instagram", href: "#contact" },
    icon: Share2,
    bg: "linear-gradient(135deg, #7c3aed 0%, #a855f7 100%)",
  },
  {
    number: 3,
    title: "Administra tus pedidos",
    description:
      "Control total desde tu Panel: edita el catálogo, gestiona productos, activa notificaciones, revisa tu historial de pedidos y más.",
    cta: { label: "Ver características del Panel", href: "#features" },
    icon: BarChart3,
    bg: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
  },
];

const HowItWorks = () => {
  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-heading"
      className="py-20 md:py-32 bg-white"
    >
      <div className="container mx-auto px-6 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-14 md:mb-20 max-w-2xl mx-auto"
        >
          <p className="text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            Cómo funciona
          </p>
          <h2
            id="how-it-works-heading"
            className="font-display font-extrabold text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight"
          >
            Pedidos más <span className="text-primary">fáciles</span> y{" "}
            <span className="text-primary">rápidos</span>, para tus clientes y
            para ti
          </h2>
        </motion.div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.55, delay: index * 0.12 }}
                className="flex flex-col items-center text-center px-2"
              >
                {/* Photo / illustration circle */}
                <div className="relative">
                  <div
                    className="w-44 h-44 sm:w-52 sm:h-52 rounded-full flex items-center justify-center shadow-[0_20px_50px_-12px_rgba(99,102,241,0.4)]"
                    style={{ background: step.bg }}
                  >
                    <Icon
                      className="w-20 h-20 text-white/95"
                      strokeWidth={1.4}
                    />
                  </div>
                  {/* Numbered badge */}
                  <div className="absolute -top-1 -right-1 w-10 h-10 rounded-full bg-white border-2 border-primary text-primary font-extrabold text-base flex items-center justify-center shadow-md">
                    {step.number}
                  </div>
                </div>

                {/* Title */}
                <h3 className="mt-7 font-display font-bold text-xl md:text-2xl text-foreground">
                  {step.title}
                </h3>

                {/* Description */}
                <p className="mt-3 text-muted-foreground text-[0.95rem] leading-relaxed max-w-xs">
                  {step.description}
                </p>

                {/* Inline CTA */}
                <a
                  href={step.cta.href}
                  target={step.cta.href.startsWith("http") ? "_blank" : undefined}
                  rel={step.cta.href.startsWith("http") ? "noopener noreferrer" : undefined}
                  className="mt-5 inline-flex items-center gap-1.5 text-primary font-semibold text-sm hover:gap-2.5 transition-all"
                >
                  {step.cta.label}
                  <ArrowRight className="h-4 w-4" />
                </a>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;
