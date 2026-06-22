import type { Category } from "../types";

export const pedidos: Category = {
  slug: "pedidos",
  title: "Pedidos",
  description:
    "Recibe, organiza y da seguimiento a las ventas de tu catálogo: cambia el estado de cada orden, crea pedidos manuales, descarga su PDF y filtra todo desde un solo lugar.",
  icon: "ClipboardList",
  articles: [
    {
      slug: "ver-pedidos",
      title: "Recibir y ver tus pedidos",
      description:
        "Dónde aparecen los pedidos de tus clientes y qué información muestra cada uno.",
      related: ["estado-pedido", "ver-detalle", "filtrar-buscar"],
      blocks: [
        {
          type: "paragraph",
          text: "Cada vez que un cliente completa una compra en tu catálogo, el pedido aparece automáticamente en la sección **Órdenes**. No tienes que hacer nada para recibirlos: se registran solos.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En el menú lateral del panel, entra a **Órdenes** (la dirección es `/admin/orders`).",
              image: "/screenshots/pedidos/menu-ordenes.png",
              imageAlt: "Opción Órdenes en el menú lateral",
            },
            {
              text: "Verás la lista de todos tus pedidos, con el más reciente arriba.",
            },
          ],
        },
        {
          type: "paragraph",
          text: "Para cada pedido la tabla muestra el **ID** (#N), el **Nombre** del cliente, los **Productos**, el **Estado**, el **WhatsApp**, la **Fecha de creación**, la **Fecha de entrega**, el **Envío** y el **Total**.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Toca el número de WhatsApp de un pedido para abrir una conversación directa con ese cliente.",
        },
        {
          type: "paragraph",
          text: "Más abajo encontrarás tarjetas de resumen con **Ventas hoy**, **Pendientes**, **Completadas** y **Canceladas** para ver de un vistazo cómo va tu día.",
        },
      ],
    },
    {
      slug: "estado-pedido",
      title: "Cambiar el estado de un pedido",
      description:
        "Marca un pedido como Pendiente, Completada o Cancelada y entiende qué pasa con tu stock.",
      related: ["ver-pedidos", "ver-detalle"],
      blocks: [
        {
          type: "paragraph",
          text: "Cada pedido tiene uno de tres estados: **Pendiente**, **Completada** o **Cancelada**. Cambiarlo te ayuda a llevar el control de qué ventas ya entregaste.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En la lista de **Órdenes**, ubica el pedido que quieres actualizar.",
            },
            {
              text: "Abre el selector de estado de ese pedido (la etiqueta de color en la columna **Estado**).",
              image: "/screenshots/pedidos/cambiar-estado.png",
              imageAlt: "Selector de estado de un pedido",
            },
            {
              text: "Elige **Pendiente**, **Completada** o **Cancelada**. El cambio se guarda al instante.",
            },
          ],
        },
        {
          type: "note",
          variant: "warning",
          text: "Cuando marcas un pedido como **Completada**, se descuenta automáticamente el stock de los productos vendidos. Si luego lo sacas de **Completada** (a Pendiente o Cancelada), ese stock se restaura.",
        },
        {
          type: "paragraph",
          text: "También puedes cambiar el estado desde el detalle del pedido, sin salir del modal.",
        },
      ],
    },
    {
      slug: "ver-detalle",
      title: "Ver el detalle de un pedido",
      description:
        "Abre la ficha completa de un pedido con productos, cliente, pago, envío y comentarios.",
      related: ["ver-pedidos", "descargar-pdf"],
      blocks: [
        {
          type: "paragraph",
          text: "El detalle te muestra toda la información del pedido en una sola ventana, sin tener que salir de la lista.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En la fila del pedido, toca el botón con el ícono de ojo, cuyo tooltip dice **Ver detalle**.",
              image: "/screenshots/pedidos/ver-detalle-boton.png",
              imageAlt: "Botón Ver detalle en la fila del pedido",
            },
            {
              text: "Se abre la ventana **Orden #N** con todos los datos.",
              image: "/screenshots/pedidos/detalle-modal.png",
              imageAlt: "Ventana de detalle del pedido",
            },
          ],
        },
        {
          type: "paragraph",
          text: "Dentro del detalle verás:",
        },
        {
          type: "list",
          items: [
            "El **Estado** (que puedes cambiar desde ahí mismo) y la fecha de **Entrega**.",
            "La tabla de productos con **Cantidad**, **Talla** y total por línea.",
            "El **Total** del pedido (y el Total en Bs si tu catálogo lo muestra).",
            "Los datos del **Cliente**: nombre, WhatsApp, correo, método de pago y método de envío.",
            "Los **Comentarios** que dejó el cliente al comprar.",
          ],
        },
      ],
    },
    {
      slug: "crear-orden-manual",
      title: "Crear una orden manual",
      description:
        "Registra una venta que recibiste por fuera del catálogo, por ejemplo por WhatsApp o en persona.",
      related: ["editar-orden", "estado-pedido"],
      blocks: [
        {
          type: "paragraph",
          text: "Si vendiste por WhatsApp, por teléfono o en persona, puedes registrar esa venta a mano para que quede contabilizada junto con las demás.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En la sección **Órdenes**, toca el botón **Crear orden manual** (arriba a la derecha).",
              image: "/screenshots/pedidos/crear-orden-manual.png",
              imageAlt: "Botón Crear orden manual",
            },
            {
              text: "Completa la **Información del cliente**: **Nombre del cliente**, **Teléfono** y **Fecha de entrega** (por defecto es hoy, puedes cambiarla). Opcionalmente, el **Método de pago** y **Comentarios**.",
            },
            {
              text: "En **Productos**, toca **Agregar producto** y elige productos de tu catálogo, o agrega un producto libre escribiendo su **Nombre**, **Precio** y **Cantidad**.",
            },
            {
              text: "Revisa el **Resumen** con el total y define el **Estado de la orden**.",
            },
            {
              text: "Toca **Guardar** para registrar la venta.",
            },
          ],
        },
        {
          type: "note",
          variant: "info",
          text: "Si guardas la orden directamente como **Completada**, recuerda que se descontará el stock de los productos del catálogo incluidos.",
        },
      ],
    },
    {
      slug: "editar-orden",
      title: "Editar una orden",
      description:
        "Corrige los datos de un pedido: cliente, productos, fecha de entrega o estado.",
      related: ["crear-orden-manual", "estado-pedido"],
      blocks: [
        {
          type: "paragraph",
          text: "¿Te equivocaste en una cantidad o el cliente cambió algo de su pedido? Puedes editar cualquier orden cuando lo necesites.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En la lista de **Órdenes**, toca el botón con el ícono de lápiz, cuyo tooltip dice **Editar**.",
              image: "/screenshots/pedidos/editar-orden.png",
              imageAlt: "Botón Editar en la fila del pedido",
            },
            {
              text: "Se abre la pantalla **Editar orden** con todos los datos ya cargados.",
            },
            {
              text: "Ajusta lo que necesites: información del cliente, productos, fecha de entrega, comentarios o estado.",
            },
            {
              text: "Toca **Guardar** para aplicar los cambios, o **Cancelar** para descartarlos.",
            },
          ],
        },
        {
          type: "note",
          variant: "tip",
          text: "Si cambias el estado a **Completada** (o lo sacas de ahí) al editar, el stock se ajusta automáticamente igual que desde la lista.",
        },
      ],
    },
    {
      slug: "descargar-pdf",
      title: "Descargar el PDF de una orden",
      description:
        "Genera un comprobante en PDF de cualquier pedido para enviárselo al cliente o archivarlo.",
      related: ["ver-detalle", "ver-pedidos"],
      blocks: [
        {
          type: "paragraph",
          text: "Puedes descargar un comprobante en PDF de cada pedido, ideal para compartirlo con el cliente o guardarlo como respaldo.",
        },
        {
          type: "steps",
          items: [
            {
              text: "En la fila del pedido, toca el botón con el ícono de descarga, cuyo tooltip dice **Descargar PDF**.",
              image: "/screenshots/pedidos/descargar-pdf.png",
              imageAlt: "Botón Descargar PDF en la fila del pedido",
            },
            {
              text: "El PDF se genera y se descarga en tu dispositivo automáticamente.",
            },
          ],
        },
        {
          type: "paragraph",
          text: "El comprobante incluye el número de orden, los productos, el total y los datos del cliente.",
        },
      ],
    },
    {
      slug: "filtrar-buscar",
      title: "Filtrar y buscar pedidos",
      description:
        "Encuentra rápido el pedido que buscas usando los filtros por estado, la búsqueda por nombre y el filtro por fecha.",
      related: ["ver-pedidos", "estado-pedido"],
      blocks: [
        {
          type: "paragraph",
          text: "Cuando tienes muchos pedidos, los filtros te ayudan a llegar al que buscas en segundos.",
        },
        {
          type: "heading",
          text: "Filtrar por estado",
        },
        {
          type: "paragraph",
          text: "Usa las pestañas **Todas**, **Pendientes**, **Completadas** y **Canceladas** para mostrar solo los pedidos de ese estado.",
        },
        {
          type: "heading",
          text: "Buscar por nombre",
        },
        {
          type: "paragraph",
          text: "Escribe en el campo **Buscar por nombre...** para filtrar los pedidos por el nombre del cliente.",
        },
        {
          type: "heading",
          text: "Filtrar por fecha",
        },
        {
          type: "paragraph",
          text: "Usa el selector **Seleccionar fecha** para ver solo los pedidos de un día concreto. Puedes limpiarlo para volver a ver todos.",
        },
        {
          type: "note",
          variant: "tip",
          text: "Puedes combinar los filtros: por ejemplo, ver solo las órdenes **Pendientes** de una fecha específica.",
        },
      ],
    },
    {
      slug: "numero-de-orden",
      title: "El número de orden por catálogo (#N)",
      description:
        "Entiende el número correlativo que se muestra en cada pedido y cómo se asigna.",
      related: ["ver-pedidos", "descargar-pdf"],
      blocks: [
        {
          type: "paragraph",
          text: "Cada pedido se identifica con un número con el formato **#N**, que ves en la columna **ID** de la lista y en el título del detalle (**Orden #N**).",
        },
        {
          type: "paragraph",
          text: "Este número es correlativo por catálogo: cada catálogo lleva su propia secuencia que empieza desde el 1 y crece con cada nuevo pedido. Así, tu primera venta es la #1, la siguiente la #2, y así sucesivamente, independientemente de otros catálogos en la plataforma.",
        },
        {
          type: "note",
          variant: "info",
          text: "El número es solo para identificar y ordenar tus pedidos de forma sencilla. No cambia aunque edites el pedido.",
        },
      ],
    },
  ],
};
