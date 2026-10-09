import type { BlogArticle } from "../types";

export const catalogoParaRepuestos2026: BlogArticle = {
  slug: "catalogo-digital-para-repuestos-y-autopartes-2026",
  category: "por-rubro",
  title: "Catálogo digital para repuestos y autopartes: la guía 2026",
  metaTitle: "Catálogo digital para repuestos y autopartes en 2026",
  metaDescription:
    "Cómo armar un catálogo digital de repuestos y autopartes: códigos, compatibilidad, buscador, importación desde Excel con IA y ventas a crédito a talleres.",
  excerpt:
    "Cientos de SKUs, clientes que preguntan pieza por pieza y talleres que compran a crédito: cómo un catálogo digital ordena la venta de repuestos.",
  author: "Equipo de CatalogoHoy",
  date: "2026-10-09",
  readMinutes: 9,
  coverTitle: "Catálogo digital para repuestos",
  coverAccent: "repuestos",
  coverTagline: "Guía por rubro 2026",
  keyPoints: [
    "En repuestos el cliente no pregunta por gusto: pregunta porque no tiene dónde buscar. Un catálogo con buscador responde por ti las 24 horas.",
    "La ficha ganadora lleva el código de la pieza en el nombre y la compatibilidad (marca, modelo, años) en la descripción.",
    "Tu lista de Excel de cientos de SKUs se convierte en catálogo en una tarde: la importación masiva con IA mapea columnas y crea los productos.",
    "A los talleres que compran a crédito puedes venderles con cuotas y recordatorios automáticos de cobranza por email o WhatsApp.",
    "Precio de contado y precio a crédito pueden convivir: el descuento o recargo por condición de pago se aplica solo en la factura.",
  ],
  blocks: [
    {
      type: "p",
      html: "El negocio de repuestos tiene un problema que casi ningún otro rubro sufre igual: <strong>el cliente no sabe si tienes la pieza hasta que te pregunta</strong>. Entonces te pregunta. Todo el día. Fotos borrosas de piezas usadas, audios de dos minutos, \"¿tienes bomba de agua para Corolla 2012?\". Un <strong>catálogo digital para repuestos y autopartes</strong> invierte la ecuación: el cliente busca la pieza, ve el precio y la compatibilidad, y te escribe solo para pedir. Esta guía explica cómo armarlo bien, con cientos de SKUs y sin cargarlos uno por uno.",
    },
    { type: "h2", id: "el-problema", text: "El día a día de vender autopartes sin catálogo" },
    {
      type: "p",
      html: "Si vendes repuestos por WhatsApp sin un catálogo con enlace, seguramente reconoces esta rutina:",
    },
    {
      type: "ul",
      items: [
        "<strong>El mismo precio, veinte veces al día:</strong> cada consulta de \"¿cuánto la pastilla de freno?\" es un chat que alguien tiene que atender.",
        "<strong>La foto borrosa:</strong> el cliente manda una imagen de la pieza vieja y tú tienes que adivinar modelo y año antes de cotizar.",
        "<strong>La lista de Excel que nadie ve:</strong> tienes el inventario en una hoja de cálculo, pero el cliente no puede consultarla — y mandarla completa por WhatsApp no es opción.",
        "<strong>El PDF del proveedor desactualizado:</strong> reenvías listas de precios que quedaron viejas con el último ajuste.",
        "<strong>Las cuentas por cobrar en un cuaderno:</strong> los talleres que te compran a crédito se anotan a mano, y cobrar depende de tu memoria.",
      ],
    },
    {
      type: "p",
      html: "Nada de esto es culpa tuya: es el límite del chat como única herramienta. El catálogo digital no reemplaza el WhatsApp — lo alimenta con pedidos ya armados. Si todavía dudas entre seguir con el PDF del proveedor o pasar a un enlace propio, <a href=\"/blog/catalogo-digital/catalogo-pdf-vs-catalogo-online-2026\">esta comparativa PDF vs catálogo online</a> resuelve la duda en cinco minutos.",
    },
    { type: "h2", id: "la-ficha", text: "La ficha de producto: código en el nombre, compatibilidad en la descripción" },
    {
      type: "p",
      html: "En autopartes la ficha de producto no es decoración: es lo que evita la pregunta y, más importante, <strong>la devolución</strong>. Un repuesto vendido para el modelo equivocado es plata perdida dos veces. La estructura que funciona es simple y constante en todos los SKUs:",
    },
    {
      type: "table",
      headers: ["Campo", "Ejemplo", "Por qué importa"],
      rows: [
        ["Nombre + código", "Bomba de agua GMB GWT-77A — Toyota Corolla", "El mecánico busca por código; el dueño del carro, por nombre de pieza."],
        ["Descripción con compatibilidad", "Compatible: Corolla 2009-2014, Yaris 2007-2013 (motor 1.8 2ZR)", "El cliente confirma solo si le sirve, sin preguntarte."],
        ["Precio visible", "$32 contado", "El \"precio por interno\" espanta compradores y te llena el chat."],
        ["Foto real de la pieza", "La pieza nueva sobre fondo claro, con el empaque", "En repuestos la foto genérica genera desconfianza."],
        ["Categoría", "Frenos / Suspensión / Motor / Eléctrico", "Con cientos de SKUs, la navegación por sistema es obligatoria."],
      ],
    },
    {
      type: "p",
      html: "Un consejo de organización: usa las categorías por <strong>sistema del vehículo</strong> (motor, frenos, suspensión, eléctrico, carrocería) y deja la marca y el modelo dentro del nombre y la descripción. Así el buscador hace el trabajo fino y las categorías dan el mapa general.",
    },
    { type: "h2", id: "buscador", text: "El buscador: que el cliente encuentre la pieza sin preguntarte" },
    {
      type: "p",
      html: "Aquí está el corazón del catálogo para este rubro. Con un buscador dentro del catálogo, el cliente escribe \"amortiguador Hilux\", \"GWT-77A\" o \"bujía NGK\" y <strong>encuentra la pieza él mismo</strong>, con precio y compatibilidad a la vista. Cada búsqueda exitosa es una consulta que no llegó a tu chat — y una venta que puede entrar a las 11 de la noche, cuando ya no estás respondiendo. Por eso los códigos en el nombre importan tanto: el buscador encuentra lo que está escrito en la ficha. Si el código solo está en tu cabeza, nadie lo puede buscar.",
    },
    { type: "h2", id: "importar", text: "De la lista de Excel al catálogo en una tarde" },
    {
      type: "p",
      html: "La objeción clásica del repuestero: \"tengo 400 SKUs, no voy a cargarlos uno por uno\". No hace falta. Con la <strong>importación masiva desde Excel</strong> subes tu lista tal como la tienes y la IA de CatalogoHoy mapea las columnas (nombre, código, precio, stock, categoría) y crea los productos automáticamente. ¿Tu proveedor te manda la lista en PDF? También se puede importar: la IA lee el documento y extrae nombres y precios.",
    },
    {
      type: "p",
      html: "Y cuando el proveedor ajusta precios — que en este rubro pasa seguido — no tienes que editar producto por producto: la <strong>actualización de precios en lote por categoría</strong> aplica un porcentaje o un monto fijo a toda una categoría de una vez. Subió 8% la línea de frenos: dos clics y el catálogo entero queda al día. Si vendes en Venezuela, el catálogo además maneja <strong>multimoneda con la tasa BCV automática</strong>: publicas en dólares y el cliente ve el equivalente en bolívares del día, sin que recalcules nada.",
    },
    {
      type: "cta",
      title: "Sube tu lista de repuestos hoy",
      text: "Importa tu Excel o el PDF de tu proveedor y la IA crea los productos con código y precio. Empieza gratis, sin tarjeta.",
      button: "Crear mi catálogo de repuestos",
    },
    { type: "h2", id: "credito", text: "Talleres que compran a crédito: cuotas y cobranza automática" },
    {
      type: "p",
      html: "El cliente más valioso de una casa de repuestos no es el particular que compra una vez: es <strong>el taller que compra todas las semanas</strong>. Y los talleres compran a crédito. El problema nunca fue venderles — es cobrarles sin perseguirlos ni incomodar la relación.",
    },
    {
      type: "p",
      html: "CatalogoHoy incluye <strong>ventas a crédito con cuotas y recordatorios automáticos de cobranza</strong>: registras la venta a crédito, defines las cuotas, y el sistema envía los recordatorios por email o WhatsApp cuando se acerca el vencimiento. Tú ves de un vistazo quién debe qué y cuándo vence, y el taller recibe el aviso del sistema — no tu mensaje incómodo de \"hola, ¿cómo vamos con lo pendiente?\".",
    },
    {
      type: "p",
      html: "Esto se complementa con el <strong>precio de contado vs precio a crédito</strong>: puedes configurar un descuento para quien paga de contado o un recargo para la condición a crédito, y el ajuste se aplica solo en la factura según lo que elija el cliente. El precio de lista es uno; la condición de pago hace el resto, sin negociar cada vez.",
    },
    { type: "h2", id: "pedidos", text: "Pedidos ordenados y stock que se descuenta solo" },
    {
      type: "p",
      html: "Cuando el cliente arma su pedido en el catálogo, te llega al WhatsApp <strong>un mensaje completo</strong>: piezas con su código, cantidades, total calculado y datos del cliente. Se acabó el ida y vuelta de \"¿me confirmas qué llevabas?\". Además, cada pedido queda registrado en un <strong>panel de órdenes</strong> que puedes exportar a Excel — útil para cuadrar el día o pasarle el resumen al contador.",
    },
    {
      type: "p",
      html: "El <strong>stock se descuenta automáticamente</strong> con cada venta, por producto. Si la última bomba de agua salió por el catálogo, el siguiente cliente ya la ve agotada — en vez de pedirla, pagarte y enterarse después de que no hay. En un rubro donde \"no tengo, pero te lo consigo\" es una conversación distinta a \"sí tengo\", que el stock publicado sea el real vale oro.",
    },
    { type: "h2", id: "planes", text: "Qué plan le conviene a una casa de repuestos" },
    {
      type: "p",
      html: "Por el volumen de SKUs, este rubro suele necesitar más que el plan de entrada. La referencia honesta:",
    },
    {
      type: "table",
      headers: ["Plan", "Precio", "Productos", "Para quién"],
      rows: [
        ["Gratis", "$0 para siempre", "10 productos, 1 catálogo", "Probar la plataforma con tus piezas de más rotación."],
        ["Básico", "$11.99/mes", "100 productos", "Un local chico con las líneas principales."],
        ["Pro", "$19.99/mes (prueba 7 días)", "500 productos", "La casa de repuestos típica: varios sistemas y marcas."],
        ["Avanzado", "$34.99/mes (prueba 7 días)", "Ilimitados + POS, CRM de chats y dominio propio", "Inventario grande, venta en mostrador y clientes a crédito."],
      ],
    },
    {
      type: "p",
      html: "Si además vendes en mostrador, el plan Avanzado suma el <strong>punto de venta (POS)</strong>: registras la venta del local y el stock se descuenta del mismo inventario que ve el catálogo. Los detalles completos están en la <a href=\"/pricing\">página de precios</a>.",
    },
    { type: "h2", id: "empezar", text: "Cómo empezar esta semana" },
    {
      type: "ol",
      items: [
        "Crea tu cuenta gratis en <a href=\"https://auth.catalogohoy.com/signup\">auth.catalogohoy.com/signup</a> y reserva tu enlace (turepuestera.catalogohoy.com).",
        "Importa tu Excel (o el PDF del proveedor) y deja que la IA cree los productos con nombre, código y precio.",
        "Revisa las fichas de tus 20 piezas de más rotación: código en el nombre, compatibilidad en la descripción, foto real.",
        "Organiza las categorías por sistema: motor, frenos, suspensión, eléctrico, carrocería.",
        "Configura tu WhatsApp de ventas y, si trabajas con talleres, activa las condiciones de contado y crédito.",
        "Comparte el enlace: cada vez que alguien pregunte por una pieza, responde con el enlace del producto.",
      ],
    },
    {
      type: "p",
      html: "La regla de oro del rubro: <strong>el catálogo responde las preguntas repetidas; tú respondes las difíciles</strong>. Compatibilidades raras, piezas por encargo, asesoría de mecánico a mecánico — ahí es donde tu conocimiento vende. Lo demás, que lo conteste el buscador.",
    },
    {
      type: "cta",
      title: "Tu mostrador abierto las 24 horas",
      text: "Códigos, compatibilidad, precios y pedidos por WhatsApp. Crea tu catálogo de autopartes gratis y súbelo de nivel cuando lo necesites.",
      button: "Empezar gratis",
    },
  ],
  faqs: [
    {
      q: "¿Cómo manejo cientos de repuestos sin cargarlos uno por uno?",
      a: "Con la importación masiva desde Excel: subes tu lista tal como la tienes y la IA de CatalogoHoy mapea las columnas (nombre, código, precio, stock) y crea los productos automáticamente. También puede leer listas de precios en PDF. Una lista de cientos de SKUs queda cargada en una tarde.",
    },
    {
      q: "¿Dónde pongo el código y la compatibilidad de cada pieza?",
      a: "El código va en el nombre del producto (por ejemplo \"Bomba de agua GMB GWT-77A — Toyota Corolla\") y la compatibilidad va en la descripción, con marcas, modelos y años. Así el buscador del catálogo encuentra la pieza tanto por código como por nombre, y el cliente confirma solo si le sirve para su vehículo.",
    },
    {
      q: "¿El cliente puede buscar una pieza dentro del catálogo?",
      a: "Sí. El catálogo incluye un buscador: el cliente escribe el nombre de la pieza, el código o el modelo del vehículo y encuentra el producto con precio y compatibilidad. Cada búsqueda exitosa es una consulta que no llega a tu WhatsApp.",
    },
    {
      q: "¿Puedo venderles a crédito a los talleres y que el sistema me ayude a cobrar?",
      a: "Sí. CatalogoHoy permite registrar ventas a crédito con cuotas y envía recordatorios automáticos de cobranza por email o WhatsApp cuando se acerca cada vencimiento. Tú ves en el panel quién debe qué, sin cuaderno ni mensajes incómodos.",
    },
    {
      q: "¿Puedo tener precio de contado y precio a crédito?",
      a: "Sí. Configuras un descuento para pago de contado o un recargo para la condición a crédito, y el ajuste se aplica automáticamente en la factura según la condición que elija el cliente. El precio de lista del catálogo es uno solo.",
    },
    {
      q: "¿Qué pasa cuando mi proveedor sube los precios?",
      a: "No editas producto por producto: con la actualización de precios en lote aplicas un porcentaje o un monto fijo a toda una categoría de una vez. Si la línea de frenos subió 8%, en dos clics todo el catálogo queda actualizado.",
    },
    {
      q: "¿Qué plan necesita una casa de repuestos?",
      a: "Depende del inventario: el plan Pro ($19.99/mes) cubre hasta 500 productos y suele alcanzar para una casa de repuestos típica. Si manejas más SKUs, vendes en mostrador con punto de venta o trabajas mucho a crédito, el Avanzado ($34.99/mes) ofrece productos ilimitados y POS. Ambos tienen prueba gratis de 7 días.",
    },
  ],
};
