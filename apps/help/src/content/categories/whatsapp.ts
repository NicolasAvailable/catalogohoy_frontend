import type { Category } from "../types";

export const whatsapp: Category = {
  slug: "whatsapp",
  title: "Notificaciones WhatsApp",
  description: "Recibe un aviso por WhatsApp cada vez que entra un pedido en tu catálogo.",
  icon: "MessageCircle",
  articles: [
    {
      slug: "que-son",
      title: "Qué son las notificaciones por WhatsApp",
      description: "Entérate al instante cuando alguien hace un pedido, sin estar mirando el panel.",
      related: ["activar-notificaciones", "que-llega-al-entrar-un-pedido"],
      blocks: [
        {
          type: "paragraph",
          text: "Las notificaciones por WhatsApp te avisan automáticamente cuando entra una orden nueva en tu catálogo. No tienes que estar revisando el panel: el mensaje te llega directo al WhatsApp del número que elijas.",
        },
        {
          type: "paragraph",
          text: "El aviso lo enviamos desde el número oficial de Catálogo Hoy, así que no necesitas conectar tu propia cuenta de WhatsApp ni instalar nada.",
        },
        {
          type: "note",
          variant: "info",
          text: "Hoy disponible: el aviso al dueño del catálogo cuando entra un pedido (**Nueva orden recibida**). Los avisos al cliente todavía no están activos.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Es una función **Pro**. Si tu cuenta está en el plan gratuito, verás la sección bloqueada con la etiqueta `Pro`.",
        },
      ],
    },
    {
      slug: "activar-notificaciones",
      title: "Activar las notificaciones y poner tu número",
      description: "Enciende el aviso de nueva orden y define a qué número quieres recibirlo.",
      related: ["que-son", "enviar-mensaje-de-prueba"],
      blocks: [
        {
          type: "paragraph",
          text: "Configuras las notificaciones desde el editor de tu catálogo, en la pestaña de configuración.",
        },
        {
          type: "steps",
          items: [
            { text: "Abre la configuración de tu catálogo y entra a la pestaña **Notificaciones**." },
            { text: "Busca la tarjeta **Notificaciones por WhatsApp**." },
            { text: "Activa el interruptor de **Nueva orden recibida**." },
            { text: "Toca **Agregar número** y escribe el número de WhatsApp donde quieres recibir el aviso.", image: "/screenshots/whatsapp/activar-numero.png" },
            { text: "Guarda los cambios para que la configuración quede aplicada." },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "Usa el número con el código de país correcto. Es el número que recibirá el WhatsApp cada vez que entre una orden.",
        },
        {
          type: "note",
          variant: "warning",
          text: "Si tu plan es gratuito, la sección aparece bloqueada con la etiqueta `Pro`. Necesitas el plan Pro para activarla.",
        },
      ],
    },
    {
      slug: "enviar-mensaje-de-prueba",
      title: "Enviar un mensaje de prueba",
      description: "Comprueba que el número recibe bien los avisos antes de tu primer pedido.",
      related: ["activar-notificaciones", "que-llega-al-entrar-un-pedido"],
      blocks: [
        {
          type: "paragraph",
          text: "Antes de esperar tu primera orden real, puedes mandarte un WhatsApp de ejemplo para confirmar que el número quedó bien escrito y que los mensajes llegan.",
        },
        {
          type: "steps",
          items: [
            { text: "En la tarjeta **Notificaciones por WhatsApp**, con el número ya cargado, toca el botón **Probar**.", image: "/screenshots/whatsapp/boton-probar.png" },
            { text: "Espera unos segundos: te enviamos un WhatsApp de ejemplo a ese número." },
            { text: "Revisa tu WhatsApp y confirma que recibiste el mensaje de prueba." },
          ],
        },
        {
          type: "note",
          variant: "info",
          text: "No necesitas guardar antes de probar: la prueba sale al número que tengas escrito en ese momento.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Si no te llega, revisa que el número y el código de país sean correctos y vuelve a intentarlo.",
        },
      ],
    },
    {
      slug: "que-llega-al-entrar-un-pedido",
      title: "Qué te llega cuando entra un pedido",
      description: "Conoce el contenido del aviso de WhatsApp y cómo ver la orden completa.",
      related: ["que-son", "activar-notificaciones"],
      blocks: [
        {
          type: "paragraph",
          text: "Cuando un cliente completa un pedido en tu catálogo, recibes un WhatsApp con el resumen de la orden en el número que configuraste.",
        },
        {
          type: "list",
          items: [
            "Un resumen de la orden recién recibida.",
            "Un botón para ver la orden completa con todos sus detalles.",
          ],
        },
        {
          type: "image",
          src: "/screenshots/whatsapp/aviso-pedido.png",
          alt: "Ejemplo de aviso de WhatsApp con el resumen de una orden",
          caption: "Así se ve el aviso cuando entra un pedido nuevo.",
        },
        {
          type: "note",
          variant: "info",
          text: "El aviso llega únicamente al número que definiste en **Nueva orden recibida**. Por ahora solo se notifica al dueño del catálogo, no al cliente.",
        },
      ],
    },
    {
      slug: "requisitos",
      title: "Requisitos para usar las notificaciones",
      description: "Lo que necesitas para activar y recibir avisos por WhatsApp.",
      related: ["activar-notificaciones", "que-son"],
      blocks: [
        {
          type: "paragraph",
          text: "Para usar las notificaciones por WhatsApp ten en cuenta estos puntos:",
        },
        {
          type: "list",
          items: [
            "Plan **Pro** activo en tu cuenta: en el plan gratuito la sección aparece bloqueada.",
            "Un número de WhatsApp válido, con su código de país, donde quieras recibir los avisos.",
            "Tener activado el interruptor de **Nueva orden recibida** y guardado el cambio.",
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "No necesitas conectar tu propia cuenta de WhatsApp: los avisos salen desde el número oficial de Catálogo Hoy.",
        },
      ],
    },
  ],
};
