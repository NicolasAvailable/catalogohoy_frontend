import type { Category } from "../types";

export const envios: Category = {
  slug: "envios",
  title: "Envíos",
  description:
    "Configura cómo entregas tus pedidos: retiro en local, entrega personal o envío, cada uno con su tarifa.",
  icon: "Truck",
  articles: [
    {
      slug: "configurar-metodos-de-envio",
      title: "Configurar métodos de envío",
      description:
        "Crea opciones de retiro, entrega o envío con sus tarifas para que aparezcan en el checkout.",
      related: ["como-elige-el-cliente", "envio-en-el-pedido"],
      blocks: [
        {
          type: "paragraph",
          text: "Los métodos de envío definen cómo el cliente recibe su pedido. Cada método tiene un **Nombre**, un **Tipo** y un **Costo**. Se configuran en el editor del catálogo, en la pestaña **Envío**.",
        },
        {
          type: "steps",
          items: [
            {
              text: "Abre el editor del catálogo y entra a la pestaña **Envío**.",
              image: "/screenshots/envios/tab-envio.png",
              imageAlt: "Pestaña Envío del editor del catálogo",
            },
            {
              text: "Activa la sección **Métodos de envío** con el interruptor de la tarjeta para mostrarla en el checkout.",
            },
            {
              text: "Pulsa **Agregar método de envío** y completa el **Nombre** (ej: `Retiro en local`).",
            },
            {
              text: "Elige el **Tipo** y escribe el **Costo**. Usa `0` para que el método sea gratis.",
            },
            {
              text: "Activa el método y guarda. Listo: aparecerá como opción de envío en el checkout.",
            },
          ],
        },
        {
          type: "heading",
          text: "Los tres tipos de método",
        },
        {
          type: "list",
          items: [
            "**Retiro en local** (`pickup`): el cliente pasa a buscar el pedido. Puedes agregar la **Dirección del local** para mostrarla en el checkout.",
            "**Entrega personal** (`delivery`): tú llevas el pedido. Puedes pedir la dirección del cliente.",
            "**Envío** (`shipping`): lo despachas a la dirección del cliente. Suele pedir la dirección de entrega.",
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "En **Costo** escribe el monto en la moneda principal del catálogo. Un costo de `0` se muestra como `Gratis` tanto en el checkout como en el pedido.",
        },
        {
          type: "heading",
          text: "Opciones extra de cada método",
        },
        {
          type: "list",
          items: [
            "**Instrucciones (opcional)**: texto que se despliega cuando el cliente selecciona el método.",
            "**Pedir la dirección al cliente**: el cliente escribe su dirección de entrega durante el checkout.",
            "**Predeterminado**: el método viene seleccionado por defecto al iniciar el pedido.",
          ],
        },
        {
          type: "note",
          variant: "info",
          text: "Puedes reordenar los métodos con las flechas. El orden es el mismo que verá el cliente en el checkout.",
        },
      ],
    },
    {
      slug: "como-elige-el-cliente",
      title: "Cómo elige el envío el cliente",
      description:
        "Qué ve el cliente al seleccionar un método de envío en el checkout y cuándo se le pide la dirección.",
      related: ["configurar-metodos-de-envio", "envio-en-el-pedido"],
      blocks: [
        {
          type: "paragraph",
          text: "Si tienes métodos de envío activos, en el checkout aparece la sección **Envío**, obligatoria. El cliente ve cada método con su nombre y su tarifa (o `Gratis` si el costo es `0`) y debe elegir uno.",
        },
        {
          type: "image",
          src: "/screenshots/envios/checkout-seleccion.png",
          alt: "Sección Envío del checkout con los métodos disponibles",
        },
        {
          type: "heading",
          text: "Cuándo se pide la dirección",
        },
        {
          type: "list",
          items: [
            "En métodos de tipo **Retiro en local**, si cargaste la **Dirección del local**, se muestra para que el cliente sepa dónde retirar.",
            "Si el método tiene activada la opción **Pedir la dirección al cliente**, aparece el campo **Dirección de entrega** (obligatorio) para que escriba calle, número y referencia.",
          ],
        },
        {
          type: "paragraph",
          text: "Al seleccionar un método, su tarifa se suma al **Total** en el **Resumen del pedido**, donde se lista como una línea aparte con el nombre del método y su costo.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Si activaste un método como **Predeterminado**, ya viene marcado al abrir el checkout; el cliente igual puede cambiarlo.",
        },
      ],
    },
    {
      slug: "envio-en-el-pedido",
      title: "El envío en el detalle del pedido",
      description:
        "Cómo se guarda y se muestra el método de envío, la tarifa y la dirección en cada pedido recibido.",
      related: ["configurar-metodos-de-envio", "como-elige-el-cliente"],
      blocks: [
        {
          type: "paragraph",
          text: "El método que el cliente elige se guarda en el pedido junto con su tarifa y, si corresponde, la dirección de entrega. Así tienes todo a la vista al preparar y despachar.",
        },
        {
          type: "paragraph",
          text: "En el detalle del pedido, la línea de envío muestra el **nombre del método**, su costo (o `Gratis` si fue `0`) y, debajo, la **dirección** cuando el cliente la cargó.",
        },
        {
          type: "image",
          src: "/screenshots/envios/detalle-pedido.png",
          alt: "Detalle del pedido mostrando el método de envío, la tarifa y la dirección",
        },
        {
          type: "note",
          variant: "info",
          text: "Los datos del envío quedan fijos en el pedido. Si luego editas o eliminas un método en la pestaña **Envío**, los pedidos ya recibidos conservan lo que el cliente eligió en su momento.",
        },
      ],
    },
  ],
};
