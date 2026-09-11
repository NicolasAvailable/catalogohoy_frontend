/**
 * Preguntas frecuentes de la home / página /faq.
 *
 * Archivo SOLO de datos (sin React) para que también lo pueda cargar el
 * prerender estático (scripts/prerender-pages.mjs) vía esbuild, igual que el
 * blog carga su data tipada. `FAQ.tsx` lo importa y lo re-exporta, así que
 * cualquier consumidor previo (`import { faqs } from ".../FAQ"`) sigue igual.
 */
export type Faq = { question: string; answer: string };

export const faqs: Faq[] = [
  {
    question: "¿Es gratis crear un catálogo digital?",
    answer:
      "Sí, CatalogoHoy ofrece un plan gratuito para siempre que incluye hasta 10 productos y 1 catálogo. Puedes empezar sin tarjeta de crédito.",
  },
  {
    question: "¿Puedo compartir mi catálogo por WhatsApp?",
    answer:
      "Sí, cada catálogo tiene un enlace único que puedes compartir directamente por WhatsApp, redes sociales o cualquier medio digital. Tus clientes pueden ver tus productos sin necesidad de descargar ninguna app.",
  },
  {
    question: "¿Qué tipo de negocios pueden usar CatalogoHoy?",
    answer:
      "CatalogoHoy es ideal para tiendas de ropa, zapaterías, joyerías, restaurantes, ferreterías y cualquier negocio que quiera mostrar sus productos de forma profesional en línea.",
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
