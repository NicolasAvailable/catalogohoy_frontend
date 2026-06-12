import type { Category } from "../types";

export const pagos: Category = {
  slug: "pagos",
  title: "Pagos",
  description:
    "Configura los métodos de pago de tu catálogo para que tus clientes elijan cómo pagar al hacer un pedido.",
  icon: "CreditCard",
  articles: [
    {
      slug: "que-son-los-metodos-de-pago",
      title: "Qué son los métodos de pago",
      description:
        "Cómo funcionan los métodos de pago en Catálogo Hoy y para qué sirven.",
      related: ["agregar-metodo-de-pago", "como-se-ven-en-el-checkout"],
      blocks: [
        {
          type: "paragraph",
          text: "Los métodos de pago son las formas en que tus clientes pueden pagarte cuando hacen un pedido desde tu catálogo. Cada método tiene un **Nombre** (por ejemplo `Zelle`, `Pago móvil`, `Transferencia` o `Efectivo`) y un **Icono** para que se reconozca fácil.",
        },
        {
          type: "paragraph",
          text: "Tú defines tus propios métodos: no hay una lista fija. Agregas los que uses en tu negocio y los activas o desactivas cuando quieras.",
        },
        {
          type: "note",
          variant: "info",
          text: "Catálogo Hoy no cobra el pago por ti ni procesa tarjetas en línea. Los métodos son una guía para que el cliente sepa cómo pagarte: tú coordinas el cobro directamente con él (por WhatsApp, transferencia, efectivo al recibir, etc.).",
        },
        {
          type: "paragraph",
          text: "El método que elija el cliente queda registrado en el pedido, así sabes cómo te va a pagar cada persona.",
        },
      ],
    },
    {
      slug: "agregar-metodo-de-pago",
      title: "Agregar un método de pago",
      description:
        "Crea un nuevo método de pago con su nombre e icono desde la configuración del catálogo.",
      related: [
        "que-son-los-metodos-de-pago",
        "activar-editar-metodos",
        "como-se-ven-en-el-checkout",
      ],
      blocks: [
        {
          type: "paragraph",
          text: "Los métodos de pago se administran desde la configuración de tu catálogo, en la pestaña **Pagos**.",
        },
        {
          type: "steps",
          items: [
            {
              text: "Entra a la configuración del catálogo y abre la pestaña **Pagos**.",
              image: "/screenshots/pagos/tab-pagos.png",
              imageAlt: "Pestaña Pagos en la configuración del catálogo",
            },
            {
              text: "Ubica la tarjeta **Métodos de pago** y asegúrate de que la sección esté activada con su interruptor.",
            },
            {
              text: "En **Agregar método de pago**, escribe el **Nombre** en el campo (por ejemplo `Zelle, Binance...`).",
              image: "/screenshots/pagos/agregar-metodo.png",
              imageAlt:
                "Formulario para agregar un método de pago con nombre e icono",
            },
            {
              text: "Elige un **Icono** del selector para que el método se identifique mejor.",
            },
            {
              text: "Pulsa **Agregar**. El método aparecerá en la lista, ya activo.",
            },
            {
              text: "Cuando termines, guarda los cambios de la configuración.",
            },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "El botón **Agregar** se habilita solo cuando escribes un nombre. Si lo dejas vacío, no podrás añadir el método.",
        },
      ],
    },
    {
      slug: "activar-editar-metodos",
      title: "Activar, desactivar y eliminar métodos",
      description:
        "Controla qué métodos de pago ve el cliente y elimina los que ya no uses.",
      related: ["agregar-metodo-de-pago", "como-se-ven-en-el-checkout"],
      blocks: [
        {
          type: "paragraph",
          text: "En la lista de **Métodos de pago** cada método tiene un interruptor para activarlo o desactivarlo y un botón para eliminarlo.",
        },
        {
          type: "heading",
          text: "Activar o desactivar un método",
        },
        {
          type: "paragraph",
          text: "Usa el interruptor que está junto a cada método. Si lo desactivas, el método sigue guardado en tu configuración pero **no aparece en el checkout**, así que el cliente no podrá elegirlo. Vuelve a activarlo cuando quieras mostrarlo de nuevo.",
        },
        {
          type: "heading",
          text: "Eliminar un método",
        },
        {
          type: "steps",
          items: [
            {
              text: "En la fila del método, pulsa el icono de papelera.",
            },
            {
              text: "Confirma en el aviso **¿Eliminar método de pago?**.",
            },
          ],
        },
        {
          type: "note",
          variant: "warning",
          text: "Eliminar un método es permanente. Si solo quieres dejar de mostrarlo por un tiempo, mejor desactívalo con el interruptor en lugar de borrarlo.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Puedes ocultar toda la sección de pagos a la vez con el interruptor del encabezado de la tarjeta **Métodos de pago**. Si lo apagas, el checkout no mostrará ningún método.",
        },
      ],
    },
    {
      slug: "como-se-ven-en-el-checkout",
      title: "Cómo se ven en el checkout",
      description:
        "Lo que el cliente ve al pagar y cómo elige su método de pago.",
      related: ["agregar-metodo-de-pago", "metodo-de-pago-en-whatsapp"],
      blocks: [
        {
          type: "paragraph",
          text: "Cuando un cliente completa su pedido, ve la sección **Método de pago** con tus métodos activos como botones, cada uno con su icono y su nombre. El cliente toca el que prefiere y queda marcado.",
        },
        {
          type: "image",
          src: "/screenshots/pagos/checkout-metodos.png",
          alt: "Sección Método de pago en el checkout con varios métodos para elegir",
          caption:
            "Así ve el cliente tus métodos de pago al finalizar el pedido.",
        },
        {
          type: "paragraph",
          text: "El método de pago es **obligatorio** cuando hay al menos un método activo: el cliente debe elegir uno para poder continuar.",
        },
        {
          type: "note",
          variant: "info",
          text: "Algunos métodos se muestran según el país del catálogo. Por ejemplo, **Pago móvil** solo aparece en catálogos de Venezuela; en otros países queda oculto automáticamente aunque lo tengas activo.",
        },
        {
          type: "paragraph",
          text: "El método elegido queda guardado en el pedido y lo puedes ver en el detalle de la orden, junto al icono de tarjeta.",
        },
      ],
    },
    {
      slug: "metodo-de-pago-en-whatsapp",
      title: "El método de pago en el mensaje de WhatsApp",
      description:
        "Cómo llega el método elegido en el resumen del pedido por WhatsApp.",
      related: ["como-se-ven-en-el-checkout"],
      blocks: [
        {
          type: "paragraph",
          text: "Al enviar el pedido por WhatsApp, el resumen incluye el método que eligió el cliente en una línea con el formato **Método de pago:** seguido del nombre del método.",
        },
        {
          type: "paragraph",
          text: "Junto al método se agrega un aviso para que coordinen el cobro: `Por favor compartir los datos para realizar el pago.` Así puedes responder con tus datos de pago (número de cuenta, correo de Zelle, etc.).",
        },
        {
          type: "note",
          variant: "tip",
          text: "Si personalizas la plantilla del mensaje, puedes ubicar el método de pago donde quieras usando la variable `{metodoPago}`. Si el cliente no eligió un método, esa parte simplemente no aparece.",
        },
      ],
    },
  ],
};
