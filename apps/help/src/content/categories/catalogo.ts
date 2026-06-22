import type { Category } from "../types";

export const catalogo: Category = {
  slug: "catalogo",
  title: "Configuración del catálogo",
  description:
    "Personaliza la identidad, el diseño y el comportamiento de tu catálogo online desde el editor.",
  icon: "Palette",
  articles: [
    {
      slug: "personalizar-diseno",
      title: "Personalizar el diseño de tu catálogo",
      description:
        "Sube tu logo y banner, elige la plantilla y el color de marca para que tu catálogo se vea único.",
      related: ["redes-sociales", "abrir-cerrar-catalogo"],
      blocks: [
        {
          type: "paragraph",
          text: "Todo el diseño de tu tienda se edita desde **Mi catálogo → Editar Catálogo**. Al abrir el editor verás varias pestañas en la parte superior: **General**, **Ubicación y Horario**, **Pagos**, **Envío**, **Redes Sociales** y **Notificaciones**. La identidad visual vive en la pestaña **General**, y a la derecha tienes una vista previa en vivo que se actualiza con cada cambio.",
        },
        {
          type: "heading",
          text: "Nombre y descripción",
        },
        {
          type: "paragraph",
          text: "En la tarjeta **Identidad de la Marca** escribes el **Nombre Comercial** (se usa en el título de la página y en las comunicaciones) y la **Descripción del Catálogo**, que aparece como resumen al compartir tu enlace. La descripción acepta formato: negrita, itálica, listas y enlaces.",
        },
        {
          type: "heading",
          text: "Plantilla del catálogo",
        },
        {
          type: "paragraph",
          text: "En la tarjeta **Plantilla del Catálogo** eliges cómo se acomodan el logo y el banner. Hay tres opciones:",
        },
        {
          type: "list",
          items: [
            "**Clásico**: logo en la barra superior, sin banner.",
            "**Centrado**: banner con el logo superpuesto encima.",
            "**Moderno**: banner con el logo centrado justo debajo.",
          ],
        },
        {
          type: "heading",
          text: "Logo y banner",
        },
        {
          type: "steps",
          items: [
            {
              text: "Activa la tarjeta **Diseño de tu catálogo** con el interruptor de la esquina.",
            },
            {
              text: "En **Logo (opcional)** toca **Subir Logo**. Recomendado: 200x200px, PNG o JPG, máximo 2MB.",
              image: "/screenshots/catalogo/diseno-logo.png",
              imageAlt: "Subir logo en el editor del catálogo",
            },
            {
              text: "En **Banner (opcional)** toca **Subir Banner**. Recomendado: 1200x400px, PNG o JPG, máximo 5MB.",
            },
          ],
        },
        {
          type: "heading",
          text: "Color del tema",
        },
        {
          type: "paragraph",
          text: "En la tarjeta **Color del tema** eliges el color de marca que se aplica a botones y detalles del catálogo. Tienes una paleta lista (Azul, Verde, Naranja, Rosa y más) o puedes tocar el botón **+** para definir un color personalizado con el selector.",
        },
        {
          type: "note",
          variant: "warning",
          text: "Los cambios no se aplican hasta que tocas **Guardar cambios**. Si intentas salir del editor con cambios sin guardar, te avisamos para que no los pierdas.",
        },
      ],
    },
    {
      slug: "redes-sociales",
      title: "Mostrar tus redes sociales",
      description:
        "Agrega los enlaces de Instagram, Facebook y TikTok para que aparezcan en el footer del catálogo.",
      related: ["personalizar-diseno"],
      blocks: [
        {
          type: "paragraph",
          text: "Puedes mostrar tus redes en el pie de página del catálogo para que los clientes te sigan. Se configuran en la pestaña **Redes Sociales** del editor.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En **Mi catálogo → Editar Catálogo** abre la pestaña **Redes Sociales**.",
            },
            {
              text: "Para cada red (**Instagram**, **Facebook**, **TikTok**) pega el enlace, por ejemplo `https://instagram.com/tu_tienda`.",
              image: "/screenshots/catalogo/redes-sociales.png",
              imageAlt: "Enlaces de redes sociales en el editor",
            },
            {
              text: "Activa el interruptor de cada red que quieras mostrar. Solo se muestran en el footer las que tengan el interruptor encendido.",
            },
            {
              text: "Toca **Guardar cambios**.",
            },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "Puedes dejar un enlace guardado pero con el interruptor apagado: queda listo para mostrarlo más adelante sin tener que volver a escribirlo.",
        },
      ],
    },
    {
      slug: "ubicacion-horario",
      title: "Configurar ubicación y horario de atención",
      description:
        "Define tu país, estado y ciudad, y los días y horas en que atiendes pedidos.",
      related: ["abrir-cerrar-catalogo"],
      blocks: [
        {
          type: "paragraph",
          text: "En la pestaña **Ubicación y Horario** del editor configuras dónde estás y cuándo atiendes. Ambos datos ayudan a tus clientes a saber cómo y cuándo comprarte.",
        },
        {
          type: "heading",
          text: "Ubicación",
        },
        {
          type: "steps",
          items: [
            {
              text: "Activa la tarjeta **Ubicación** con el interruptor de la esquina.",
            },
            {
              text: "Elige tu **País**, luego el **Estado / Provincia** y la **Ciudad**. Según el país, el estado y la ciudad se cargan automáticamente como lista para seleccionar.",
              image: "/screenshots/catalogo/ubicacion.png",
              imageAlt: "Selección de país, estado y ciudad",
            },
          ],
        },
        {
          type: "heading",
          text: "Horario de atención",
        },
        {
          type: "paragraph",
          text: "En la tarjeta **Horario de atención** defines los días que abres y la hora de **apertura** y **cierre** de cada uno. Cada día tiene su propio interruptor: los días marcados como **Cerrado** no se muestran como disponibles en el catálogo, pero conservan sus horas para que puedas reactivarlos sin volver a escribirlas.",
        },
        {
          type: "note",
          variant: "info",
          text: "El horario es informativo para tus clientes. Para pausar las ventas por completo, usa el interruptor del botón \"Ir a pagar\" en la pestaña **General**.",
        },
      ],
    },
    {
      slug: "abrir-cerrar-catalogo",
      title: "Abrir o cerrar el catálogo para pedidos",
      description:
        "Pausa las ventas cuando lo necesites y vuelve a activarlas con un solo interruptor.",
      related: ["ubicacion-horario", "personalizar-mensaje-whatsapp"],
      blocks: [
        {
          type: "paragraph",
          text: "Si necesitas dejar de recibir pedidos temporalmente (por vacaciones, falta de stock o cualquier motivo), puedes pausar las ventas sin ocultar el catálogo. Tus productos siguen visibles, pero el botón de pago desaparece.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En **Mi catálogo → Editar Catálogo** abre la pestaña **General** y baja hasta la tarjeta **Comportamiento**.",
            },
            {
              text: "Usa el interruptor **Botón \"Ir a pagar\"** para activar o pausar las ventas.",
              image: "/screenshots/catalogo/abrir-cerrar.png",
              imageAlt: "Interruptor de aceptar pedidos en Comportamiento",
            },
          ],
        },
        {
          type: "paragraph",
          text: "El recuadro de estado te confirma la situación: **Ventas Activas** (tus clientes pueden pagar) o **Ventas Pausadas** (el botón de pago queda oculto).",
        },
        {
          type: "note",
          variant: "tip",
          text: "Pausar las ventas no oculta tu catálogo: los clientes pueden seguir viendo tus productos, solo que no podrán finalizar la compra hasta que vuelvas a activarlo.",
        },
      ],
    },
    {
      slug: "personalizar-mensaje-whatsapp",
      title: "Personalizar el mensaje de WhatsApp del pedido",
      description:
        "Edita el texto que se envía por WhatsApp cuando un cliente confirma su pedido usando variables.",
      related: ["abrir-cerrar-catalogo"],
      blocks: [
        {
          type: "paragraph",
          text: "Cuando un cliente confirma un pedido, se arma un mensaje de WhatsApp con los datos de la orden. Puedes personalizar ese texto en la pestaña **Pagos**, en la tarjeta **Mensaje de WhatsApp**.",
        },
        {
          type: "paragraph",
          text: "Escribes el mensaje libremente e insertas **variables** que se reemplazan automáticamente por los datos reales de cada pedido. Haz clic en una variable para insertarla donde tengas el cursor. Las disponibles son:",
        },
        {
          type: "list",
          items: [
            "`{nombre}` — nombre del cliente",
            "`{telefono}` — teléfono del cliente",
            "`{productos}` — lista de productos del pedido",
            "`{total}` — total del pedido",
            "`{totalBs}` — total en bolívares",
            "`{envio}` — método de envío",
            "`{direccion}` — dirección del cliente",
            "`{comentarios}` — comentarios del cliente",
            "`{metodoPago}` — método de pago",
          ],
        },
        {
          type: "note",
          variant: "info",
          text: "Si quitas una variable del mensaje, ese dato no se incluirá. Hay un contador de caracteres (máximo 1000) y un botón **Restaurar mensaje predeterminado** para volver al texto original.",
        },
        {
          type: "image",
          src: "/screenshots/catalogo/mensaje-whatsapp.png",
          alt: "Editor del mensaje de WhatsApp con variables",
        },
      ],
    },
    {
      slug: "mostrar-ocultar-secciones",
      title: "Mostrar u ocultar secciones del catálogo",
      description:
        "Controla qué partes ve tu cliente: diseño, métodos de pago, ubicación y la barra de categorías.",
      related: ["personalizar-diseno", "ubicacion-horario"],
      blocks: [
        {
          type: "paragraph",
          text: "Varias tarjetas del editor tienen un interruptor en la esquina superior derecha que muestra u oculta esa sección en el catálogo público. Así decides qué información ve tu cliente.",
        },
        {
          type: "list",
          items: [
            "**Diseño de tu catálogo** (pestaña General): muestra u oculta el logo y el banner.",
            "**Categorías** (pestaña General): muestra u oculta la barra de categorías en el catálogo.",
            "**Métodos de pago** (pestaña Pagos): muestra u oculta la lista de formas de pago.",
            "**Ubicación** (pestaña Ubicación y Horario): muestra u oculta tu país, estado y ciudad.",
          ],
        },
        {
          type: "steps",
          items: [
            {
              text: "Abre **Mi catálogo → Editar Catálogo** y ve a la pestaña donde está la sección.",
            },
            {
              text: "Usa el interruptor de la esquina de la tarjeta para mostrarla u ocultarla. Cuando está apagada, los campos se ven atenuados.",
              image: "/screenshots/catalogo/mostrar-ocultar.png",
              imageAlt: "Interruptor para mostrar u ocultar una sección",
            },
            {
              text: "Toca **Guardar cambios** y revisa el resultado en la vista previa.",
            },
          ],
        },
      ],
    },
  ],
};
