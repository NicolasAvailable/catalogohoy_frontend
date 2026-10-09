import type { BlogArticle } from "../types";

export const catalogoParaMayoristas2026: BlogArticle = {
  slug: "catalogo-digital-para-mayoristas-y-distribuidoras-2026",
  category: "por-rubro",
  title: "Catálogo digital para mayoristas y distribuidoras: guía 2026",
  metaTitle: "Catálogo digital para mayoristas: venta al mayor 2026",
  metaDescription:
    "Cómo vender al por mayor por WhatsApp con un catálogo digital: precios escalonados por cantidad, pedidos grandes ordenados, stock en tiempo real y Excel.",
  excerpt:
    "Precios por cantidad, pedidos grandes que llegan ordenados al WhatsApp y stock en tiempo real: el catálogo digital pensado para vender al por mayor.",
  author: "Equipo de CatalogoHoy",
  date: "2026-10-09",
  readMinutes: 9,
  coverTitle: "Catálogo digital para mayoristas",
  coverAccent: "mayoristas",
  coverTagline: "Guía por rubro 2026",
  keyPoints: [
    "El mayorista no necesita una tienda online de retail: necesita precios escalonados por cantidad y pedidos grandes que lleguen ordenados.",
    "Con precios al por mayor por cantidad, el catálogo muestra el precio correcto según cuántas piezas lleve el cliente — sin negociar cada vez.",
    "Un pedido de 40 líneas llega al WhatsApp como un mensaje estructurado con cantidades y total, no como una cadena de audios.",
    "El stock en tiempo real evita el peor momento de la venta mayorista: confirmar un pedido grande que no puedes despachar.",
    "La lista de precios vive en Excel: se importa masivamente con IA y se actualiza en lote cuando cambian los costos.",
  ],
  blocks: [
    {
      type: "p",
      html: "Vender al por mayor por WhatsApp tiene una dinámica propia: pedidos de muchas líneas, precios que dependen de la cantidad, clientes que recompran cada semana y una lista de precios que cambia con cada ajuste del proveedor. Las tiendas online de retail no están hechas para eso — y el PDF de siempre, menos. Un <strong>catálogo digital para mayoristas</strong> resuelve lo específico del rubro: que el cliente vea el precio correcto según cuánto lleva, arme su pedido grande sin ayuda y te lo mande ordenado. Veamos cómo.",
    },
    { type: "h2", id: "el-problema", text: "Cómo se ve la venta al mayor sin catálogo (y cuánto cuesta)" },
    {
      type: "ul",
      items: [
        "<strong>El pedido por audio:</strong> \"mándame 12 de las blancas, 6 de las negras talla M, no, mejor 8…\". Transcribir audios a pedido es un trabajo de tiempo completo — y la fuente número uno de errores de despacho.",
        "<strong>La negociación repetida:</strong> cada cliente nuevo pregunta \"¿y si llevo 20, a cuánto me queda?\". La respuesta siempre es la misma, pero alguien tiene que escribirla.",
        "<strong>La lista de precios viajera:</strong> versiones viejas del PDF circulando entre clientes, y reclamos cuando el precio ya no es ese.",
        "<strong>El faltante descubierto tarde:</strong> confirmas un pedido de 30 piezas y al armarlo descubres que quedan 18. Ese cliente lo recuerda.",
        "<strong>El vendedor sin material:</strong> tu vendedor en la calle muestra fotos sueltas desde su teléfono, cada uno con una versión distinta del precio.",
      ],
    },
    {
      type: "p",
      html: "Cada uno de estos problemas tiene un costo silencioso en horas y en pedidos mal despachados. Y todos comparten la misma causa: la información (precios, cantidades, stock) vive en tu cabeza o en un archivo, no en un lugar que el cliente pueda consultar. Si tu herramienta actual es un PDF, <a href=\"/blog/catalogo-digital/catalogo-pdf-vs-catalogo-online-2026\">esta comparativa PDF vs catálogo online</a> explica en detalle por qué se queda corto.",
    },
    { type: "h2", id: "precios-escalonados", text: "Precios escalonados por cantidad: el corazón del catálogo mayorista" },
    {
      type: "p",
      html: "La regla número uno del mayoreo: <strong>el precio depende de la cantidad</strong>. CatalogoHoy permite configurar precios al por mayor por rangos de cantidad en cada producto, y el catálogo muestra la escala completa para que el cliente vea de entrada cuánto gana llevando más:",
    },
    {
      type: "table",
      headers: ["Cantidad", "Precio por pieza", "Total del rango"],
      rows: [
        ["1 a 5 piezas", "$22", "Desde $22"],
        ["6 a 19 piezas", "$18", "Desde $108"],
        ["20 piezas o más", "$12", "Desde $240"],
      ],
    },
    {
      type: "p",
      html: "El efecto es doble. Primero, <strong>se acaba la negociación repetida</strong>: la escala está publicada y es igual para todos. Segundo — y esto lo saben bien los mayoristas — la escala visible <strong>empuja el ticket hacia arriba</strong>: el cliente que iba a llevar 5 piezas ve que a partir de 6 el precio baja de $22 a $18, y redondea para arriba. El descuento por volumen deja de ser un favor que pides y pasa a ser una oferta que vende sola.",
    },
    { type: "h2", id: "pedidos-ordenados", text: "Pedidos grandes que llegan ordenados, no en audios" },
    {
      type: "p",
      html: "Un pedido mayorista puede tener 30 o 40 líneas. En el catálogo, el cliente lo arma él mismo: navega por categorías, elige cantidades por producto (con el precio escalonado aplicándose solo) y al confirmar, te llega al WhatsApp <strong>un solo mensaje estructurado</strong>: cada producto con su cantidad, el total calculado y los datos del cliente. Nada que transcribir, nada que interpretar.",
    },
    {
      type: "p",
      html: "Además, cada pedido queda registrado en el <strong>panel de órdenes</strong>, con su cliente y su historial. ¿Necesitas cuadrar la semana o preparar la facturación? El panel <strong>exporta a Excel</strong> con un clic. Para una distribuidora, ese registro ordenado de quién pidió qué y cuándo es la diferencia entre administrar y adivinar.",
    },
    { type: "h2", id: "stock", text: "Stock en tiempo real: no vendas lo que no puedes despachar" },
    {
      type: "p",
      html: "El peor momento de la venta al mayor es confirmar un pedido grande y descubrir el faltante al armarlo. En CatalogoHoy el <strong>stock se descuenta automáticamente con cada venta</strong> — también por variante, si manejas tallas o colores —, así que el catálogo siempre muestra la disponibilidad real. Si de un producto quedan 18 piezas, el cliente lo ve antes de pedir 30, y ajusta su pedido él mismo en lugar de enterarse después. Tu palabra como proveedor vale más cuando el stock publicado es el stock verdadero.",
    },
    { type: "h2", id: "excel", text: "Tu lista de precios vive en Excel — y el catálogo lo entiende" },
    {
      type: "p",
      html: "Ningún mayorista va a cargar 300 productos a mano, y no hace falta. La <strong>importación masiva desde Excel</strong> sube tu lista tal como la tienes: la IA mapea las columnas (nombre, precio, stock, categoría) y crea los productos automáticamente. También puede leer catálogos y listas en PDF.",
    },
    {
      type: "p",
      html: "Y cuando los costos cambian, no vuelves a empezar: la <strong>actualización de precios en lote por categoría</strong> aplica un porcentaje o un monto fijo a toda una línea de productos de una vez. Subió el costo de importación un 10%: seleccionas la categoría, aplicas el ajuste y el catálogo completo queda al día en minutos — el mismo enlace, sin reenviar nada a nadie. Si distribuyes en Venezuela, la <strong>multimoneda con tasa BCV automática</strong> muestra el equivalente en bolívares del día sin que recalcules.",
    },
    {
      type: "cta",
      title: "Convierte tu lista de precios en catálogo mayorista",
      text: "Importa tu Excel, configura precios por cantidad y empieza a recibir pedidos ordenados por WhatsApp. Gratis para probar, sin tarjeta.",
      button: "Crear mi catálogo mayorista",
    },
    { type: "h2", id: "vendedor-calle", text: "El vendedor en la calle y el despacho en el local" },
    {
      type: "p",
      html: "Una distribuidora vende en dos frentes, y el catálogo sirve en ambos. <strong>En la calle</strong>, tu vendedor lleva el catálogo completo en el teléfono: precios al día, stock real y la escala de mayoreo publicada. Visita al cliente, arma el pedido con él desde el enlace y el pedido entra por el mismo canal que todos — registrado, con su cliente y su total. Se acabaron las versiones distintas de la lista según qué vendedor atienda.",
    },
    {
      type: "p",
      html: "<strong>En el local</strong>, el plan Avanzado suma el <strong>punto de venta (POS)</strong>: el cliente que llega a retirar o a comprar en mostrador se despacha ahí mismo, y la venta descuenta el stock del mismo inventario que alimenta el catálogo. Un solo inventario para la calle, el WhatsApp y el mostrador — que es exactamente como debería ser.",
    },
    { type: "h2", id: "planes", text: "Qué plan le conviene a un mayorista" },
    {
      type: "table",
      headers: ["Plan", "Precio", "Productos", "Para quién"],
      rows: [
        ["Gratis", "$0 para siempre", "10 productos, 1 catálogo", "Probar la mecánica con tu línea principal."],
        ["Básico", "$11.99/mes", "100 productos", "Mayorista de catálogo corto y mucha rotación."],
        ["Pro", "$19.99/mes (prueba 7 días)", "500 productos", "La distribuidora típica con varias líneas."],
        ["Avanzado", "$34.99/mes (prueba 7 días)", "Ilimitados + POS, CRM de chats y dominio propio", "Catálogo grande, mostrador con despacho y equipo de ventas."],
      ],
    },
    {
      type: "p",
      html: "La comparación completa de funciones está en la <a href=\"/pricing\">página de precios</a>. Los planes Pro y Avanzado tienen prueba gratis de 7 días — suficiente para importar tu lista, configurar la escala de mayoreo y recibir los primeros pedidos reales.",
    },
    { type: "h2", id: "empezar", text: "Puesta en marcha: de la lista al primer pedido" },
    {
      type: "ol",
      items: [
        "Crea tu cuenta en <a href=\"https://auth.catalogohoy.com/signup\">auth.catalogohoy.com/signup</a> y reserva tu enlace (tudistribuidora.catalogohoy.com).",
        "Importa tu lista de precios desde Excel — la IA crea los productos y tú solo revisas.",
        "Configura los precios escalonados por cantidad en tus productos de mayor rotación.",
        "Carga el stock real: a partir de aquí se descuenta solo con cada venta.",
        "Pasa el enlace a tus vendedores y fíjalo en el WhatsApp del negocio.",
        "Cuando un cliente pida \"la lista\", responde con el enlace: siempre actualizado, con la escala de precios visible.",
      ],
    },
    {
      type: "p",
      html: "El cambio de fondo es este: hoy tu operación depende de que alguien conteste, cotice y transcriba. Con el catálogo, <strong>el cliente hace el trabajo de armar su pedido</strong> — y tu equipo se dedica a despachar, cobrar y conseguir clientes nuevos.",
    },
    {
      type: "cta",
      title: "Pedidos al mayor, sin audios",
      text: "Escala de precios publicada, stock real y pedidos de 40 líneas que llegan en un solo mensaje. Pruébalo gratis con tu propia lista.",
      button: "Empezar gratis",
    },
  ],
  faqs: [
    {
      q: "¿Puedo poner precios distintos según la cantidad que lleve el cliente?",
      a: "Sí. CatalogoHoy permite configurar precios al por mayor por rangos de cantidad en cada producto — por ejemplo $22 por unidad, $18 a partir de 6 piezas y $12 a partir de 20. El catálogo muestra la escala completa y aplica el precio correcto automáticamente en el pedido.",
    },
    {
      q: "¿Cómo llega un pedido grande de muchas líneas a mi WhatsApp?",
      a: "Como un solo mensaje estructurado: cada producto con su cantidad, el total calculado con los precios escalonados y los datos del cliente. Además, el pedido queda registrado en el panel de órdenes, desde donde puedes exportar todo a Excel.",
    },
    {
      q: "¿El catálogo muestra el stock real a mis clientes?",
      a: "Sí. El stock se descuenta automáticamente con cada venta, por producto y por variante, así que el catálogo siempre refleja la disponibilidad real. Un cliente que quiere 30 piezas ve antes de pedir si solo quedan 18, y ajusta su pedido él mismo.",
    },
    {
      q: "¿Cómo actualizo los precios cuando cambian mis costos?",
      a: "En lote: seleccionas una categoría y aplicas un porcentaje o un monto fijo a todos sus productos de una vez. También puedes reimportar tu Excel actualizado. El enlace del catálogo es siempre el mismo, así que los clientes ven los precios nuevos al instante sin que reenvíes nada.",
    },
    {
      q: "¿Sirve para mi vendedor que visita clientes en la calle?",
      a: "Sí. El vendedor lleva el catálogo completo en su teléfono, con precios al día, escala de mayoreo y stock real. Arma el pedido con el cliente desde el mismo enlace y la orden entra registrada al sistema como cualquier otra, con su total calculado.",
    },
    {
      q: "¿Puedo despachar también a los clientes que compran en el local?",
      a: "Sí, con el punto de venta (POS) incluido en el plan Avanzado ($34.99/mes): registras la venta de mostrador y el stock se descuenta del mismo inventario que ve el catálogo. Un solo inventario para el local, la calle y el WhatsApp.",
    },
    {
      q: "¿Cuánto cuesta un catálogo mayorista en CatalogoHoy?",
      a: "Puedes empezar gratis con 10 productos para probar la mecánica. El plan Básico ($11.99/mes) llega a 100 productos, el Pro ($19.99/mes) a 500 y el Avanzado ($34.99/mes) ofrece productos ilimitados más punto de venta y CRM de chats. Pro y Avanzado tienen prueba gratis de 7 días.",
    },
  ],
};
