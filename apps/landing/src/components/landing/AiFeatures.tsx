import { ImagePlus, Scissors, Eraser, Wand2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

const items = [
  {
    icon: ImagePlus,
    title: "Genera imágenes con IA",
    description: "Crea fotos de producto profesionales a partir de un texto.",
  },
  {
    icon: Scissors,
    title: "Quita el fondo con IA",
    description: "Deja tus fotos con un fondo limpio y uniforme en un clic.",
  },
  {
    icon: Eraser,
    title: "Borrador a mano",
    description: "Borra lo que sobra de la imagen pasando el cursor, estilo Canva.",
  },
  {
    icon: Wand2,
    title: "Mejora la descripción con IA",
    description: "Convierte una descripción simple en un texto claro y vendedor.",
  },
];

const AiFeatures = () => {
  return (
    <section
      id="ai"
      aria-labelledby="ai-heading"
      className="py-24 md:py-32 bg-white"
    >
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Captura (izquierda en desktop, arriba en mobile) */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <div className="rounded-2xl border border-border/60 shadow-xl shadow-primary/10 overflow-hidden bg-white">
              <img
                src="/ai-generate-preview.png"
                alt="Generar imagen de producto con IA"
                className="w-full h-auto block"
                loading="lazy"
              />
            </div>
          </motion.div>

          {/* Contenido (derecha en desktop) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.6 }}
          >
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary uppercase tracking-wider mb-3">
              <Sparkles className="h-4 w-4" /> Inteligencia Artificial
            </p>
            <h2
              id="ai-heading"
              className="font-display font-extrabold text-3xl md:text-4xl lg:text-5xl text-foreground leading-tight"
            >
              Crea y mejora tus productos
              <span className="text-primary"> con un solo clic.</span>
            </h2>
            <p className="mt-4 text-muted-foreground text-lg">
              La IA integrada en el editor te ayuda a tener un catálogo
              profesional sin diseñador ni redactor. Cada plan incluye créditos
              de IA mensuales.
            </p>

            <ul className="mt-8 flex flex-col gap-5">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-4">
                  <div className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-xl bg-primary/10 text-primary">
                    <item.icon className="h-5 w-5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <h3 className="font-display font-bold text-base text-foreground">
                      {item.title}
                    </h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default AiFeatures;
