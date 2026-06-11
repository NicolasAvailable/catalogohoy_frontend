import type { Category } from "../types";

export const empezando: Category = {
  slug: "empezando",
  title: "Empezando",
  description: "Todo lo que necesitas para crear tu catálogo y empezar a vender.",
  icon: "Rocket",
  articles: [
    {
      slug: "crear-tu-catalogo",
      title: "Crear tu catálogo",
      description:
        "Crea tu cuenta y tu primer catálogo en minutos, sin tarjeta de crédito.",
      blocks: [
        {
          type: "paragraph",
          text: "Con Catálogo Hoy creas una tienda online en minutos: subes tus productos, personalizas tu catálogo y compartes un solo enlace para empezar a recibir pedidos. No necesitas conocimientos técnicos ni tarjeta de crédito para empezar.",
        },
        {
          type: "steps",
          items: [
            {
              text: "Entra a **catalogohoy.com** y toca **Empezar gratis**.",
              image: "/screenshots/empezando/signup-1.png",
            },
            {
              text: "Ingresa tu **nombre**, **correo** y una **contraseña**. También puedes registrarte con Google.",
              image: "/screenshots/empezando/signup-2.png",
            },
            {
              text: "Elige el **nombre de tu negocio** y el **enlace** (slug) de tu catálogo, por ejemplo `catalogohoy.com/tu-tienda`.",
              image: "/screenshots/empezando/signup-3.png",
            },
            {
              text: "Acepta los términos y toca **Crear catálogo**. ¡Listo! Ya estás en tu panel de administración.",
            },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "El enlace de tu catálogo lo puedes cambiar después, pero conviene elegir uno corto y fácil de recordar desde el inicio.",
        },
      ],
      related: ["conocer-el-panel", "compartir-tu-catalogo"],
    },
    {
      slug: "conocer-el-panel",
      title: "Conocer el panel de administración",
      description:
        "Un recorrido por las secciones de tu panel: productos, pedidos, tasas y más.",
      blocks: [
        {
          type: "paragraph",
          text: "El panel de administración es donde gestionas todo tu catálogo. Lo encuentras en `tu-tienda.catalogohoy.com/admin`. Desde el menú lateral accedes a todas las secciones.",
        },
        {
          type: "image",
          src: "/screenshots/empezando/panel-overview.png",
          alt: "Panel de administración de Catálogo Hoy",
          caption: "Vista general del panel con el menú lateral.",
        },
        {
          type: "list",
          items: [
            "Inicio: un resumen de tu actividad y accesos rápidos.",
            "Productos: crea y edita tus productos y sus categorías.",
            "Órdenes: revisa y gestiona los pedidos que recibes.",
            "Clientes: el historial de quienes te han comprado.",
            "Analíticas: métricas de visitas y ventas.",
            "Tasas del día: configura la conversión de moneda.",
            "Equipo: invita a otras personas a ayudarte.",
            "Mi catálogo: personaliza el diseño y comparte tu tienda.",
          ],
        },
      ],
      related: ["crear-tu-catalogo"],
    },
    {
      slug: "compartir-tu-catalogo",
      title: "Compartir tu catálogo",
      description:
        "Copia tu enlace y compártelo en Instagram, WhatsApp y donde vendas.",
      blocks: [
        {
          type: "paragraph",
          text: "Tu catálogo vive en un enlace propio con tu nombre. Compártelo en la bio de Instagram, en tus estados de WhatsApp o donde quieras; tus clientes entran, eligen y te envían el pedido completo.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En el panel, toca el ícono de **compartir** arriba a la derecha.",
              image: "/screenshots/empezando/compartir-1.png",
            },
            {
              text: "Copia tu enlace `tu-tienda.catalogohoy.com` o usa el **código QR** para imprimirlo.",
              image: "/screenshots/empezando/compartir-2.png",
            },
            {
              text: "Pégalo en el campo **enlace de la bio** de Instagram para que tus seguidores ordenen con un toque.",
            },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "¿Vendes por Instagram? Pon \"👇 Pedí acá 👇\" junto al enlace en tu bio para guiar a tus clientes.",
        },
      ],
      related: ["conocer-el-panel"],
    },
  ],
};
