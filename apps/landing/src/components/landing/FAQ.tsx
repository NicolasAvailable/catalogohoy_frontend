import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";

const faqs = [
  {
    question: "¿Es gratis crear un catálogo digital?",
    answer:
      "Sí, Catálogo Hoy ofrece un plan gratuito para siempre que incluye hasta 10 productos y 1 catálogo. Puedes empezar sin tarjeta de crédito.",
  },
  {
    question: "¿Puedo compartir mi catálogo por WhatsApp?",
    answer:
      "Sí, cada catálogo tiene un enlace único que puedes compartir directamente por WhatsApp, redes sociales o cualquier medio digital. Tus clientes pueden ver tus productos sin necesidad de descargar ninguna app.",
  },
  {
    question: "¿Qué tipo de negocios pueden usar Catálogo Hoy?",
    answer:
      "Catálogo Hoy es ideal para tiendas de ropa, zapaterías, joyerías, restaurantes, ferreterías y cualquier negocio que quiera mostrar sus productos de forma profesional en línea.",
  },
  {
    question: "¿Puedo cambiar de plan en cualquier momento?",
    answer:
      "Sí, puedes mejorar o cambiar tu plan cuando quieras. No hay contratos ni permanencia mínima. Si necesitas más productos o funcionalidades, simplemente sube de plan.",
  },
  {
    question: "¿Cómo recibo las órdenes de mis clientes?",
    answer:
      "Las órdenes llegan directamente a tu panel de administración en tiempo real. Puedes gestionarlas, ver el detalle de cada pedido y hacer seguimiento desde un solo lugar.",
  },
  {
    question: "¿Puedo tener precios en diferentes monedas?",
    answer:
      "Sí, puedes configurar tasas de cambio del día para mostrar precios en bolívares y dólares. La tasa se actualiza fácilmente desde tu panel.",
  },
];

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  return (
    <section
      id="faq"
      aria-labelledby="faq-heading"
      className="py-24 md:py-32"
      style={{
        fontFamily: "'Inter var', 'Inter', ui-sans-serif, system-ui, sans-serif",
        background: "linear-gradient(180deg, #dbeafe 0%, #eef4ff 30%, #f8faff 60%, #ffffff 100%)",
      }}
    >
      <div className="mx-auto px-6 max-w-[800px]">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <span className="inline-block text-[0.8rem] font-semibold text-[#6366f1] uppercase tracking-[0.05em] mb-2">
            FAQ
          </span>
          <h2 id="faq-heading" className="text-[2rem] font-extrabold text-[#1e293b] leading-tight">
            Preguntas frecuentes
          </h2>
          <p className="text-[#64748b] mt-2 text-[0.95rem]">
            Todo lo que necesitas saber antes de empezar.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="flex flex-col gap-3"
        >
          {faqs.map((faq, index) => (
            <div
              key={index}
              className={`rounded-2xl border transition-all duration-200 ${
                openIndex === index
                  ? "border-[#c7d2fe] bg-[#fafafe] shadow-sm"
                  : "border-[#e2e8f0] bg-white hover:border-[#cbd5e1]"
              }`}
            >
              <button
                onClick={() => toggle(index)}
                className="flex items-center justify-between w-full px-6 py-5 text-left cursor-pointer bg-transparent border-none"
                aria-expanded={openIndex === index}
              >
                <span className="text-[0.95rem] font-semibold text-[#1e293b] pr-4">
                  {faq.question}
                </span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-[#94a3b8] transition-transform duration-200 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence initial={false}>
                {openIndex === index && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-[0.9rem] text-[#64748b] leading-relaxed">
                      {faq.answer}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FAQ;
