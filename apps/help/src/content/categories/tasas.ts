import type { Category } from "../types";

export const tasas: Category = {
  slug: "tasas",
  title: "Tasas del día",
  description:
    "Configura la tasa de cambio activa para que tu catálogo convierta los precios en dólares a bolívares de forma automática.",
  icon: "TrendingUp",
  articles: [
    {
      slug: "que-es-la-tasa-del-dia",
      title: "Qué es la tasa del día y cómo funciona",
      description:
        "Entiende cómo Catálogo Hoy convierte tus precios en dólares a la moneda local usando la tasa que elijas.",
      related: ["tipos-de-tasa", "fijar-tasa-personalizada", "mostrar-doble-moneda"],
      blocks: [
        {
          type: "paragraph",
          text: "La **tasa del día** es el valor de cambio que usa tu catálogo para convertir los precios de tus productos a la moneda local. Tú cargas tus productos en una sola moneda (por ejemplo USD) y el catálogo calcula automáticamente cuánto cuesta cada producto en bolívares (`Bs.`) según la tasa que tengas activa.",
        },
        {
          type: "paragraph",
          text: "Encuentras esta configuración en el menú **Tasas del día** del panel. Ahí ves la tasa **Dólar BCV** (`USD / VES`), la tasa **Euro BCV** (`EUR / VES`) y la **Tasa personalizada**, y eliges cuál quieres que use tu catálogo.",
        },
        {
          type: "note",
          variant: "info",
          text: "Las tasas BCV (oficiales) se sincronizan automáticamente cada 4 horas, así que no tienes que actualizarlas a mano.",
        },
        {
          type: "image",
          src: "/screenshots/tasas/tasas-del-dia.png",
          alt: "Pantalla Tasas del día con las tarjetas de Dólar BCV, Euro BCV y Tasa personalizada",
          caption: "El módulo Tasas del día muestra las tres tarjetas de tasa disponibles.",
        },
        {
          type: "note",
          variant: "tip",
          text: "La tasa solo cambia cómo se muestra el precio convertido. El precio base de tus productos siempre se mantiene en la moneda en la que los cargaste.",
        },
      ],
    },
    {
      slug: "tipos-de-tasa",
      title: "Tipos de tasa disponibles",
      description:
        "Conoce las opciones: sin conversión, Dólar BCV, Euro BCV y tasa personalizada.",
      related: ["que-es-la-tasa-del-dia", "fijar-tasa-personalizada", "en-que-moneda-cobras"],
      blocks: [
        {
          type: "paragraph",
          text: "Tu catálogo puede trabajar con cuatro modos de conversión. Eliges uno según cómo quieras mostrar los precios a tus clientes:",
        },
        {
          type: "list",
          items: [
            "**Ninguna** (`none`): el catálogo no convierte. Tus precios se muestran solo en la moneda en la que cargaste los productos, sin equivalente en bolívares.",
            "**Dólar BCV** (`bcv_usd`): usa la tasa oficial `USD / VES` del BCV, que se sincroniza sola cada 4 horas.",
            "**Euro BCV** (`bcv_eur`): usa la tasa oficial `EUR / VES` del BCV, también sincronizada automáticamente.",
            "**Personalizada** (`custom`): usas una tasa que tú mismo defines y actualizas a mano.",
          ],
        },
        {
          type: "paragraph",
          text: "En el módulo **Tasas del día** seleccionas la tarjeta que quieras (**Dólar BCV**, **Euro BCV** o **Tasa personalizada**) y esa pasa a ser la tasa activa. La tasa activa es la que el catálogo usa para convertir todos tus precios.",
        },
        {
          type: "note",
          variant: "info",
          text: "Las tarjetas **Dólar BCV** y **Euro BCV** llevan la insignia Oficial; la **Tasa personalizada** lleva la insignia Editable porque su valor lo controlas tú.",
        },
      ],
    },
    {
      slug: "fijar-tasa-personalizada",
      title: "Fijar una tasa personalizada",
      description:
        "Define manualmente la tasa de cambio que quieres usar en tu catálogo.",
      related: ["tipos-de-tasa", "que-es-la-tasa-del-dia"],
      blocks: [
        {
          type: "paragraph",
          text: "Si prefieres no usar la tasa oficial del BCV, puedes fijar tu propia **Tasa personalizada**. Es útil cuando manejas una tasa de venta distinta a la oficial.",
        },
        {
          type: "steps",
          items: [
            {
              text: "Entra al menú **Tasas del día** desde tu panel.",
              image: "/screenshots/tasas/tasas-del-dia.png",
              imageAlt: "Módulo Tasas del día abierto",
            },
            {
              text: "Ubica la tarjeta **Tasa personalizada** y, en el campo **Ajustar tasa manualmente**, escribe el valor en `VES` (bolívares por cada dólar).",
              image: "/screenshots/tasas/tasa-personalizada.png",
              imageAlt: "Editor de la tarjeta Tasa personalizada con el campo de valor",
            },
            {
              text: "Pulsa **Guardar** para registrar el nuevo valor.",
            },
            {
              text: "Marca la casilla **Seleccionar** de la tarjeta **Tasa personalizada** para activarla como la tasa que usará el catálogo.",
            },
          ],
        },
        {
          type: "note",
          variant: "warning",
          text: "La tasa personalizada no se actualiza sola: si el mercado cambia, tienes que volver a editarla y guardarla. Las tasas BCV sí se sincronizan automáticamente.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Solo el propietario y los miembros del equipo con permiso para editar Tasas pueden cambiar el valor. Los demás ven las tasas pero no pueden modificarlas.",
        },
      ],
    },
    {
      slug: "mostrar-doble-moneda",
      title: "Mostrar precios en doble moneda",
      description:
        "Activa para que tu catálogo muestre el precio en dólares y su equivalente en bolívares.",
      related: ["que-es-la-tasa-del-dia", "en-que-moneda-cobras"],
      blocks: [
        {
          type: "paragraph",
          text: "Puedes mostrar a tus clientes el precio en dos monedas a la vez: el precio de referencia (por ejemplo en `USD`) y su equivalente convertido en moneda local (`Bs.`). Esto se configura en el editor de tu catálogo, en la sección **Monedas del catálogo**.",
        },
        {
          type: "steps",
          items: [
            {
              text: "Abre el editor de tu catálogo y ve a la sección **Monedas del catálogo**.",
              image: "/screenshots/tasas/monedas-catalogo.png",
              imageAlt: "Sección Monedas del catálogo en el editor",
            },
            {
              text: "En **Moneda local** elige la moneda en la que precias tus productos.",
            },
            {
              text: "En **Moneda de referencia** elige `$ Dólar` o `€ Euro` para mostrar el precio convertido con la tasa BCV.",
            },
            {
              text: "Activa **Mostrar precio de referencia** para que se vea el precio en la moneda de referencia en el catálogo público.",
            },
            {
              text: "Activa **Mostrar precio en moneda local** para que se vea el precio convertido (`Bs.`) según la tasa configurada.",
            },
          ],
        },
        {
          type: "note",
          variant: "info",
          text: "Si activas las dos opciones, tus clientes ven ambos precios juntos en cada producto. Si solo activas una, verán únicamente esa.",
        },
        {
          type: "note",
          variant: "tip",
          text: "El precio convertido en bolívares siempre usa la tasa activa que definiste en **Tasas del día**. Si cambias la tasa, los precios mostrados se recalculan.",
        },
      ],
    },
    {
      slug: "en-que-moneda-cobras",
      title: "En qué moneda se calculan los pedidos",
      description:
        "Aclara la diferencia entre la moneda de tus productos, la de referencia y la del total del pedido.",
      related: ["mostrar-doble-moneda", "tipos-de-tasa"],
      blocks: [
        {
          type: "paragraph",
          text: "En Catálogo Hoy conviven dos monedas, y conviene tenerlas claras para saber cómo se calculan los totales de cada pedido:",
        },
        {
          type: "list",
          items: [
            "**Moneda local**: la moneda en la que cargas y precias tus productos (por ejemplo `USD`).",
            "**Moneda de referencia**: la moneda en la que se expresa el total del pedido que ve el cliente y que aparece en las notificaciones (por ejemplo `Bs.` con la tasa BCV).",
          ],
        },
        {
          type: "paragraph",
          text: "El total del pedido se calcula con la tasa activa de **Tasas del día** al momento de la compra. Por eso, cuando llega una orden, el mensaje de WhatsApp puede incluir tanto el total como su equivalente en bolívares (las variables `{total}` y `{totalBs}`).",
        },
        {
          type: "note",
          variant: "warning",
          text: "La plataforma calcula y muestra los montos, pero el cobro lo coordinas tú con tu cliente. Define con claridad en qué moneda recibes el pago para evitar confusiones por las variaciones de la tasa.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Si vendes fuera de Venezuela, puedes dejar la conversión en Ninguna: tus precios se muestran solo en la moneda de tus productos, sin equivalente en bolívares.",
        },
      ],
    },
  ],
};
