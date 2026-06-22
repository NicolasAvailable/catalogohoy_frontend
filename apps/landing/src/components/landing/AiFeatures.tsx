import { ImagePlus, Scissors, Eraser, Wand2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const aiFeatures = [
  {
    icon: ImagePlus,
    title: "Genera imágenes con IA",
    description:
      "Crea fotos de producto profesionales a partir de un texto. Ideal cuando no tienes una buena foto a mano.",
  },
  {
    icon: Scissors,
    title: "Quita el fondo con IA",
    description:
      "Deja tus fotos con un fondo limpio y uniforme en un solo clic. Tu catálogo se ve más profesional al instante.",
  },
  {
    icon: Eraser,
    title: "Borrador a mano",
    description:
      "Borra lo que sobra de la imagen pasando el cursor, estilo Canva. Control total sobre el recorte.",
  },
  {
    icon: Wand2,
    title: "Mejora la descripción con IA",
    description:
      "Convierte una descripción simple en un texto claro y vendedor. Mejorar, alargar o acortar en un toque.",
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

const AiFeatures = () => {
  return (
    <section
      id="ai"
      aria-labelledby="ai-heading"
      className="py-24 md:py-32 bg-white"
    >
      <div className="container mx-auto px-6 max-w-6xl">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary uppercase tracking-wider mb-3">
            <Sparkles className="h-4 w-4" /> Inteligencia Artificial
          </p>
          <h2
            id="ai-heading"
            className="font-display font-extrabold text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight"
          >
            Crea y mejora tus productos
            <br />
            <span className="text-primary">con un solo clic.</span>
          </h2>
          <p className="mt-4 text-muted-foreground text-lg max-w-xl">
            La IA integrada en el editor te ayuda a tener un catálogo profesional
            sin diseñador ni redactor. Cada plan incluye créditos de IA mensuales.
          </p>
        </motion.div>

        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6"
        >
          {aiFeatures.map((feature, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="group rounded-2xl border border-border/60 bg-white p-7 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/20 transition-all duration-300 hover:-translate-y-1.5"
            >
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary mb-5 group-hover:scale-110 transition-transform duration-300">
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

export default AiFeatures;
