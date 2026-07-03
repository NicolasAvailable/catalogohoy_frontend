import {
  ImagePlus,
  Scissors,
  Eraser,
  Wand2,
  Sparkles,
  ChevronDown,
  Plus,
  X,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  ImageIcon,
  WandSparkles,
} from "lucide-react";
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
            {/* Mockup del modal real del editor (Generador de imágenes de IA).
                Reconstruido en JSX para que quede nítido y siga al modal si
                cambia. Acentos en violeta como en la app. */}
            <div
              role="img"
              aria-label="Generador de imágenes de IA en el editor de CatalogoHoy"
              className="relative"
            >
              {/* Halo suave: da la sensación de modal flotante. */}
              <div
                aria-hidden="true"
                className="absolute -inset-4 rounded-[2rem] bg-gradient-to-tr from-violet-200/50 via-primary/5 to-transparent blur-2xl"
              />
              <div className="relative rounded-2xl border border-border/70 bg-white shadow-2xl shadow-primary/10 p-5 sm:p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-violet-500" />
                    <span className="font-display font-bold text-sm sm:text-base text-foreground">
                      Generador de imágenes de IA
                    </span>
                  </div>
                  <X className="h-4 w-4 text-muted-foreground" />
                </div>

                {/* Cuerpo: controles (izq.) + preview (der.) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {/* Controles */}
                  <div className="flex flex-col gap-4">
                    {/* Proporción */}
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1.5">
                        Proporción de imagen
                      </p>
                      <div className="flex items-center gap-1.5">
                        <span className="h-9 px-3 inline-flex items-center rounded-lg border border-violet-300 bg-violet-50 text-violet-600 text-xs font-semibold">
                          Auto
                        </span>
                        <span className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground">
                          <Square className="h-4 w-4" />
                        </span>
                        <span className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground">
                          <RectangleHorizontal className="h-4 w-4" />
                        </span>
                        <span className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-border text-muted-foreground">
                          <RectangleVertical className="h-4 w-4" />
                        </span>
                      </div>
                    </div>

                    {/* Estilo */}
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1.5">
                        Estilo de imagen
                      </p>
                      <div className="h-10 px-3 flex items-center justify-between rounded-lg border border-border bg-white">
                        <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
                          <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                          Predeterminado
                        </span>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </div>
                    </div>

                    {/* Describe */}
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1.5">
                        Describe tu imagen
                      </p>
                      <div className="h-[4.25rem] rounded-lg border border-border bg-white px-3 py-2 text-xs leading-relaxed text-muted-foreground/70">
                        Ej: gorra roja de béisbol sobre fondo blanco, foto de
                        producto profesional, luz suave
                      </div>
                    </div>

                    {/* Insertar */}
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground">Insertar:</span>
                      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-border text-foreground">
                        <Plus className="h-3 w-3" /> Título
                      </span>
                      <span className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-border text-foreground">
                        <Plus className="h-3 w-3" /> Descripción
                      </span>
                    </div>

                    {/* CTA */}
                    <div className="mt-0.5 h-11 inline-flex items-center justify-center gap-2 rounded-lg border-2 border-violet-300 bg-violet-50/40 text-violet-600 text-sm font-semibold">
                      <WandSparkles className="h-4 w-4" />
                      Generar imagen con IA
                    </div>
                  </div>

                  {/* Preview */}
                  <div className="rounded-xl border-2 border-dashed border-border bg-muted/40 min-h-[15rem] flex flex-col items-center justify-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-9 w-9" strokeWidth={1.5} />
                    <span className="text-xs">Acá vas a ver tu imagen</span>
                  </div>
                </div>
              </div>
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
