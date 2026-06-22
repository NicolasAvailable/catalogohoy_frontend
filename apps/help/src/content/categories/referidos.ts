import type { Category } from "../types";

export const referidos: Category = {
  slug: "referidos",
  title: "Referidos",
  description:
    "Invita a otros emprendedores con tu link, gana crédito en USD cuando hacen su primer pago y úsalo para tu suscripción de Catálogo Hoy.",
  icon: "Gift",
  articles: [
    {
      slug: "como-funciona-el-programa",
      title: "Cómo funciona el programa de referidos",
      description:
        "Comparte tu link, tu invitado recibe un descuento y tú ganas crédito cuando se convierte en cliente que paga.",
      related: ["donde-esta-mi-link", "como-y-cuando-gano-credito", "en-que-uso-mi-credito"],
      blocks: [
        {
          type: "paragraph",
          text: "El programa de referidos te deja invitar a otros emprendedores a Catálogo Hoy y ser recompensado por cada uno que se vuelve cliente que paga. Es una manera de hacer crecer la comunidad y, de paso, ahorrar en tu propia suscripción.",
        },
        {
          type: "heading",
          text: "La idea en pocas palabras",
        },
        {
          type: "list",
          items: [
            "Cada negocio tiene un **código de referido** único y un link compartible.",
            "Tu invitado se registra usando tu link (o pegando tu código en el registro) y recibe un **descuento en su primer pago**.",
            "Cuando ese negocio hace su primer pago y queda **calificado**, tú ganas **crédito en USD**.",
            "Ese crédito se descuenta automáticamente de tu próxima renovación.",
          ],
        },
        {
          type: "heading",
          text: "Los montos",
        },
        {
          type: "paragraph",
          text: "Por defecto ganas `$5 USD` de crédito por cada referido calificado, y tu invitado recibe un `20%` de descuento en su primer pago. Estos valores son configurables, así que pueden ajustarse con el tiempo. El monto que ganaste por cada referido se muestra en tu panel.",
        },
        {
          type: "heading",
          text: "Los estados de un referido",
        },
        {
          type: "paragraph",
          text: "Cada persona que invitas pasa por distintos estados, que verás en la columna **Status** de tu lista de referidos:",
        },
        {
          type: "list",
          items: [
            "**Pendiente**: se registró con tu link pero todavía no hizo su primer pago.",
            "**Calificado**: hizo su primer pago y cumple las condiciones del programa.",
            "**Acreditado**: el crédito ya se sumó a tu balance.",
            "**Expirado**: no completó el pago a tiempo o no pasó las reglas anti-fraude.",
          ],
        },
        {
          type: "note",
          variant: "info",
          text: "Por privacidad no mostramos el email ni el nombre de tus referidos. Solo verás la fecha de registro, el estado y el crédito ganado.",
        },
      ],
    },
    {
      slug: "donde-esta-mi-link",
      title: "Dónde está tu link y cómo compartirlo",
      description:
        "Encuentra tu código y link de referido en el panel Referidos y compártelo con un solo clic.",
      related: ["como-funciona-el-programa", "como-y-cuando-gano-credito"],
      blocks: [
        {
          type: "paragraph",
          text: "Tu link de referido vive dentro del panel de administración, en la sección **Referidos**. Desde ahí lo copias y lo compartes por donde prefieras.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En el menú lateral, entra a **Referidos**.",
              image: "/screenshots/referidos/menu-referidos.png",
              imageAlt: "Menú lateral con la opción Referidos",
            },
            {
              text: "Arriba verás la tarjeta **Tu link de referido** con tu enlace listo para compartir.",
              image: "/screenshots/referidos/panel-referidos.png",
              imageAlt: "Panel de referidos con el link compartible",
            },
            {
              text: "Pulsa **Copiar**. El botón cambia a **Copiado ✓** cuando el link queda en tu portapapeles.",
            },
            {
              text: "Pega el link en WhatsApp, Instagram, un correo o donde quieras invitar a otros emprendedores.",
            },
          ],
        },
        {
          type: "paragraph",
          text: "Tu link tiene la forma `https://catalogohoy.com/?ref=TUCODIGO`. Debajo del link también puedes ver tu **código** por separado, por si alguien prefiere registrarse y pegarlo manualmente.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Cuando tu invitado abre el link, su código de referido queda guardado. Al registrarse aparece ya cargado en el campo **Código de referido** del formulario, así no tiene que copiarlo a mano.",
        },
      ],
    },
    {
      slug: "como-y-cuando-gano-credito",
      title: "Cómo y cuándo ganas crédito",
      description:
        "Ganas crédito cuando tu referido hace su primer pago y queda calificado. Aquí te explicamos las condiciones.",
      related: ["como-funciona-el-programa", "en-que-uso-mi-credito"],
      blocks: [
        {
          type: "paragraph",
          text: "No ganas crédito solo porque alguien se registre con tu link. El crédito se acredita cuando ese negocio **hace su primer pago** de la suscripción y pasa las reglas del programa.",
        },
        {
          type: "heading",
          text: "El recorrido del crédito",
        },
        {
          type: "list",
          items: [
            "Tu invitado se registra con tu link: queda como **Pendiente**.",
            "Tu invitado hace su primer pago: pasa a **Calificado**.",
            "Si todo está en orden, se suma el crédito a tu balance y pasa a **Acreditado**.",
          ],
        },
        {
          type: "heading",
          text: "El tope mensual",
        },
        {
          type: "paragraph",
          text: "Hay un límite de referidos que pueden calificar por mes (por defecto `10`). Una vez alcanzado el tope, los referidos adicionales de ese mes no acreditan crédito. Es una medida para mantener el programa sano y es configurable según la temporada.",
        },
        {
          type: "heading",
          text: "Reglas anti-fraude",
        },
        {
          type: "paragraph",
          text: "Para que el programa sea justo, validamos cada referido antes de acreditar. Un referido puede quedar **Expirado** si:",
        },
        {
          type: "list",
          items: [
            "Te refieres a ti mismo (por ejemplo, el correo del invitado coincide con el tuyo).",
            "Se superó el tope mensual de referidos calificados.",
            "El primer pago no se completa dentro de la ventana de calificación.",
          ],
        },
        {
          type: "note",
          variant: "warning",
          text: "Los referidos auto-referidos o que no pasan las validaciones quedan en estado **Expirado** y no generan crédito.",
        },
        {
          type: "paragraph",
          text: "Cuando un referido queda acreditado, el monto ganado aparece en la columna **Crédito** de tu lista, y tu **Crédito disponible** se actualiza en el resumen del panel.",
        },
      ],
    },
    {
      slug: "en-que-uso-mi-credito",
      title: "En qué puedes usar tu crédito",
      description:
        "El crédito de referidos solo se usa para pagar tu suscripción de Catálogo Hoy: no es retirable ni transferible.",
      related: ["como-y-cuando-gano-credito", "como-funciona-el-programa"],
      blocks: [
        {
          type: "paragraph",
          text: "El crédito que ganas con referidos es un saldo interno en USD. Sirve para una sola cosa: **pagar tu suscripción de Catálogo Hoy**.",
        },
        {
          type: "heading",
          text: "Para qué sirve",
        },
        {
          type: "list",
          items: [
            "Se descuenta automáticamente de tu próxima **renovación**.",
            "También puede aplicarse a **catálogos o planes adicionales** dentro de Catálogo Hoy.",
            "No necesitas hacer nada: el sistema lo aplica solo cuando hay saldo disponible.",
          ],
        },
        {
          type: "heading",
          text: "Lo que el crédito NO es",
        },
        {
          type: "note",
          variant: "warning",
          text: "El crédito **no es dinero retirable** en efectivo ni transferible a otra cuenta. Solo puede usarse para pagar planes dentro de Catálogo Hoy.",
        },
        {
          type: "heading",
          text: "Dónde ves tu saldo",
        },
        {
          type: "paragraph",
          text: "En el panel **Referidos** encuentras un resumen con cuatro indicadores: **Crédito disponible**, **Crédito usado**, referidos **Acreditados** y referidos **Pendientes**. Así sabes en todo momento cuánto has ganado y cuánto te queda por aplicar.",
        },
        {
          type: "image",
          src: "/screenshots/referidos/resumen-credito.png",
          alt: "Resumen del crédito con disponible, usado, acreditados y pendientes",
          caption: "Resumen de tu crédito y referidos en el panel Referidos.",
        },
      ],
    },
  ],
};
