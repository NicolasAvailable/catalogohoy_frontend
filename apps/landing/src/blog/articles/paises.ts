import type { BlogArticle } from "../types";

/**
 * Guías por país (playbook vacantes.com): un artículo "Cómo crear un catálogo
 * digital gratis en {País} (2026)" por cada país de LATAM. La estructura es
 * una plantilla probada y el contenido se LOCALIZA con datos reales del país
 * (moneda, métodos de pago, envíos, contexto) — cada artículo es único, no un
 * duplicado con el nombre cambiado.
 */
interface CountryData {
  /** Nombre con artículo si aplica ("República Dominicana"). */
  name: string;
  /** Para frases tipo "los negocios {demonym}". */
  demonym: string;
  slug: string;
  currency: string;
  currencyNote: string;
  /** Métodos de pago locales: [nombre, cómo se usa]. */
  payMethods: [string, string][];
  /** Envíos/entregas típicos del país. */
  shipping: string;
  /** Color local para la intro (1 frase). */
  intro: string;
}

const COUNTRIES: CountryData[] = [
  {
    name: "Venezuela", demonym: "venezolanos", slug: "venezuela",
    currency: "bolívares y dólares",
    currencyNote: "En Venezuela se vende en dos monedas a la vez: precios de referencia en dólares y cobro en bolívares a la tasa del día. Tu catálogo debería mostrar ambos — CatalogoHoy calcula el monto en Bs. automáticamente con la tasa BCV.",
    payMethods: [
      ["Pago Móvil", "el método rey: transferencia inmediata entre bancos con el número de teléfono"],
      ["Transferencia bancaria", "Banesco, Banco de Venezuela, Mercantil y Provincial son las más pedidas"],
      ["Zelle", "muy usado para cobrar en dólares, sobre todo en ventas al mayor"],
      ["Efectivo en divisas", "todavía común en entregas presenciales"],
    ],
    shipping: "Para envíos nacionales los negocios usan MRW, Zoom y Tealca (cobro en destino incluido); en las ciudades, delivery en moto coordinado por WhatsApp.",
    intro: "El comercio venezolano vive en WhatsApp: estados, grupos y catálogos reenviados mueven más ventas que cualquier centro comercial.",
  },
  {
    name: "Colombia", demonym: "colombianos", slug: "colombia",
    currency: "pesos colombianos",
    currencyNote: "Los precios van en pesos colombianos (COP). Ojo con escribirlos claros: \"$25.000\" — el catálogo con el precio visible evita la clásica pregunta \"¿precio?\" en cada publicación.",
    payMethods: [
      ["Nequi", "la billetera más usada para pagos entre personas y compras a negocios"],
      ["Daviplata", "la alternativa fuerte, sobre todo fuera de las grandes ciudades"],
      ["Transferencia Bancolombia", "el clásico para montos mayores"],
      ["Contraentrega", "clave para generar confianza en la primera compra"],
    ],
    shipping: "Servientrega, Interrapidísimo y Coordinadora dominan los envíos nacionales; la contraentrega sigue siendo el gancho de conversión número uno.",
    intro: "En Colombia el social selling explotó: entre Nequi, la contraentrega y WhatsApp, un negocio puede vender a todo el país sin local físico.",
  },
  {
    name: "México", demonym: "mexicanos", slug: "mexico",
    currency: "pesos mexicanos",
    currencyNote: "Los precios van en pesos (MXN). Si vendes al mayoreo y al detal, deja claras ambas listas — el catálogo permite precios de mayoreo por cantidad.",
    payMethods: [
      ["Transferencia SPEI", "inmediata y sin costo entre bancos, el estándar"],
      ["Mercado Pago", "link de pago con tarjeta, muy usado por negocios en redes"],
      ["Depósito en OXXO", "imprescindible para clientes sin cuenta bancaria"],
      ["Efectivo contra entrega", "común en ventas locales de barrio y tianguis online"],
    ],
    shipping: "Estafeta, DHL y paqueterías con guías prepagadas resuelven el envío nacional; muchos negocios ofrecen \"envío gratis desde $X\" para subir el ticket.",
    intro: "México es el mercado de social commerce más grande de habla hispana: millones de negocios venden por WhatsApp, Facebook e Instagram todos los días.",
  },
  {
    name: "Argentina", demonym: "argentinos", slug: "argentina",
    currency: "pesos argentinos",
    currencyNote: "Con la inflación, actualizar precios es rutina semanal. La ventaja del catálogo online: cambias el precio una vez y el enlace queda actualizado para todos — nada de reenviar listas.",
    payMethods: [
      ["Mercado Pago", "el ecosistema dominante: link de pago, QR y dinero en cuenta"],
      ["Transferencia por alias/CBU", "inmediata y sin comisión, la preferida entre particulares"],
      ["Efectivo", "vigente en entregas presenciales y puntos de encuentro"],
    ],
    shipping: "Correo Argentino, OCA y Andreani cubren el país; en AMBA y grandes ciudades, moto-mensajería coordinada por WhatsApp el mismo día.",
    intro: "El emprendedor argentino domina la venta por redes como nadie — lo que falta casi siempre es ordenar el caos de pedidos que llegan por chat.",
  },
  {
    name: "Perú", demonym: "peruanos", slug: "peru",
    currency: "soles",
    currencyNote: "Los precios van en soles (S/). El comprador peruano compara mucho: el precio visible en el catálogo te mete en la comparación; el \"precio por interno\" te deja fuera.",
    payMethods: [
      ["Yape", "el QR/billetera más usado del país, prácticamente universal"],
      ["Plin", "la alternativa interbancaria que completa el combo"],
      ["Transferencia BCP/Interbank", "para montos mayores"],
      ["Contraentrega", "muy valorada en la primera compra"],
    ],
    shipping: "Olva Courier y Shalom mueven los envíos nacionales a buen precio; en Lima, motorizados por apps o coordinados por WhatsApp.",
    intro: "Entre Yape y WhatsApp, en Perú se paga y se coordina una venta en minutos — el negocio que responde primero con su catálogo se lleva la venta.",
  },
  {
    name: "Chile", demonym: "chilenos", slug: "chile",
    currency: "pesos chilenos",
    currencyNote: "Los precios van en pesos chilenos (CLP), sin decimales. El comprador chileno espera claridad total: precio, costo de envío y plazos antes de decidir.",
    payMethods: [
      ["Transferencia bancaria", "inmediata y gratuita, el método por defecto"],
      ["Mercado Pago / links de pago", "para cobrar con tarjeta sin tener web propia"],
      ["MACH y billeteras", "populares entre compradores jóvenes"],
    ],
    shipping: "Chilexpress, Starken y Blue Express cubren el territorio; los puntos de retiro abaratan el envío en regiones.",
    intro: "Chile combina alta bancarización con compra online madura: un catálogo prolijo con precios claros marca la diferencia frente al competidor informal.",
  },
  {
    name: "Ecuador", demonym: "ecuatorianos", slug: "ecuador",
    currency: "dólares",
    currencyNote: "Ecuador usa el dólar (USD), así que los precios son directos y sin conversiones — aprovecha para mostrarlos siempre visibles.",
    payMethods: [
      ["Transferencia bancaria", "Pichincha, Guayaquil y Produbanco son las más usadas"],
      ["De Una / billeteras", "los pagos con QR crecen rápido"],
      ["Efectivo contra entrega", "sigue siendo clave fuera de Quito y Guayaquil"],
    ],
    shipping: "Servientrega y Tramaco resuelven el envío nacional; en las ciudades grandes, motorizados coordinados por WhatsApp.",
    intro: "En Ecuador el negocio se cierra conversando: el catálogo con precios en dólares ahorra la mitad de esa conversación y acelera el sí.",
  },
  {
    name: "Bolivia", demonym: "bolivianos", slug: "bolivia",
    currency: "bolivianos",
    currencyNote: "Los precios van en bolivianos (Bs). El QR interbancario hizo que cobrar sea instantáneo — tu catálogo debe decir claramente que aceptas QR.",
    payMethods: [
      ["QR Simple", "el QR interbancario que unificó los pagos en el país"],
      ["Tigo Money", "billetera móvil muy extendida"],
      ["Transferencia bancaria", "BNB, Mercantil Santa Cruz y Unión"],
      ["Efectivo", "vigente en entregas presenciales"],
    ],
    shipping: "Flotas interdepartamentales y couriers locales llevan paquetes entre ciudades; la entrega se coordina casi siempre por WhatsApp.",
    intro: "Con el QR Simple, en Bolivia se cobra en segundos; lo que suele faltar es un catálogo ordenado que evite dictar la lista de precios chat por chat.",
  },
  {
    name: "Guatemala", demonym: "guatemaltecos", slug: "guatemala",
    currency: "quetzales",
    currencyNote: "Los precios van en quetzales (Q). Si también vendes al mayoreo, deja ambas listas claras en el catálogo con precios por cantidad.",
    payMethods: [
      ["Transferencia bancaria", "Banrural, BI y BAM concentran la mayoría"],
      ["Depósito bancario", "común para clientes sin banca en línea"],
      ["Efectivo contra entrega", "el método de confianza en la primera compra"],
    ],
    shipping: "Guatex y Cargo Expreso cubren el interior; en la capital, mensajería en moto coordinada por WhatsApp.",
    intro: "El comercio guatemalteco es intensivo en WhatsApp y Facebook: un enlace de catálogo profesional te separa de la foto borrosa con precio en el comentario.",
  },
  {
    name: "Honduras", demonym: "hondureños", slug: "honduras",
    currency: "lempiras",
    currencyNote: "Los precios van en lempiras (L). Mostrarlos visibles filtra curiosos y atrae al comprador decidido.",
    payMethods: [
      ["Transferencia bancaria", "BAC, Atlántida y Occidente son las más pedidas"],
      ["Tigo Money", "billetera móvil útil para cobrar sin banco"],
      ["Efectivo contra entrega", "el estándar en ventas locales"],
    ],
    shipping: "Cargo Expreso y couriers locales conectan las ciudades principales; la entrega se coordina por WhatsApp.",
    intro: "En Honduras la venta por catálogo y redes crece fuerte — y el negocio que muestra precios claros y responde rápido es el que factura.",
  },
  {
    name: "El Salvador", demonym: "salvadoreños", slug: "el-salvador",
    currency: "dólares",
    currencyNote: "El Salvador usa el dólar (USD): precios directos, sin conversiones. Aprovecha y muéstralos siempre.",
    payMethods: [
      ["Transferencia bancaria", "Banco Agrícola y BAC dominan"],
      ["Billeteras y pagos móviles", "en crecimiento constante"],
      ["Efectivo contra entrega", "muy usado en ventas dentro de la ciudad"],
    ],
    shipping: "Couriers locales y mensajería en moto resuelven el país (es compacto: casi todo llega en 24-48h).",
    intro: "En un país compacto como El Salvador, un catálogo con precios claros + entrega en 24h es una máquina de recompra.",
  },
  {
    name: "Nicaragua", demonym: "nicaragüenses", slug: "nicaragua",
    currency: "córdobas",
    currencyNote: "Los precios van en córdobas (C$), aunque muchos negocios también referencian en dólares — el catálogo debe dejar claro en qué moneda cobras.",
    payMethods: [
      ["Transferencia bancaria", "Banpro, BAC y Lafise"],
      ["Efectivo contra entrega", "el método más común"],
      ["Billeteras móviles", "en adopción creciente"],
    ],
    shipping: "Couriers locales y buses expresos mueven paquetes entre departamentos; la coordinación es 100% por WhatsApp.",
    intro: "El comercio nicaragüense se mueve en WhatsApp y Facebook: ordenar los pedidos con un catálogo es la mejora más rápida que puedes hacer.",
  },
  {
    name: "Costa Rica", demonym: "costarricenses", slug: "costa-rica",
    currency: "colones",
    currencyNote: "Los precios van en colones (₡) y a veces en dólares. Con SINPE Móvil el cobro es inmediato — dilo en tu catálogo.",
    payMethods: [
      ["SINPE Móvil", "el método universal: transferencia inmediata con el número de teléfono"],
      ["Transferencia bancaria", "BAC, BCR y Banco Nacional"],
      ["Efectivo", "en entregas presenciales"],
    ],
    shipping: "Correos de Costa Rica y couriers privados cubren el país; en GAM, mensajería el mismo día.",
    intro: "Con SINPE Móvil, en Costa Rica cualquiera te puede pagar en 10 segundos — el cuello de botella es el pedido desordenado, y eso lo arregla el catálogo.",
  },
  {
    name: "Panamá", demonym: "panameños", slug: "panama",
    currency: "dólares",
    currencyNote: "Panamá usa el dólar (USD). Con Yappy, el cobro entre particulares y negocios es instantáneo.",
    payMethods: [
      ["Yappy", "la billetera del Banco General que domina los pagos cotidianos"],
      ["Transferencia ACH", "entre bancos locales"],
      ["Efectivo contra entrega", "vigente en ventas dentro de la ciudad"],
    ],
    shipping: "Uno Express y couriers locales cubren el país; en Ciudad de Panamá, mensajería el mismo día coordinada por WhatsApp.",
    intro: "En Panamá \"¿tienes Yappy?\" es parte de cualquier venta — combínalo con un catálogo con precios claros y cierras en un solo chat.",
  },
  {
    name: "Paraguay", demonym: "paraguayos", slug: "paraguay",
    currency: "guaraníes",
    currencyNote: "Los precios van en guaraníes (₲), sin decimales y con números grandes: escríbelos claros (₲150.000) para evitar confusiones.",
    payMethods: [
      ["Transferencia bancaria / SIPAP", "inmediata entre bancos"],
      ["Billeteras (Tigo Money, Billetera Personal)", "muy usadas para montos cotidianos"],
      ["Efectivo contra entrega", "común en Asunción y alrededores"],
    ],
    shipping: "AEX y couriers locales mueven paquetes; los buses de encomienda siguen siendo clave para el interior.",
    intro: "El comercio paraguayo por redes crece a doble dígito: el que ordena sus pedidos con catálogo escala; el que sigue a puro chat se estanca.",
  },
  {
    name: "Uruguay", demonym: "uruguayos", slug: "uruguay",
    currency: "pesos uruguayos",
    currencyNote: "Los precios van en pesos uruguayos ($U). El comprador uruguayo es detallista: descripción completa y precio claro convierten más que cualquier descuento.",
    payMethods: [
      ["Transferencia bancaria", "BROU y bancos privados"],
      ["Mercado Pago", "links de pago con tarjeta muy extendidos"],
      ["Efectivo", "en entregas y puntos de retiro"],
    ],
    shipping: "DAC, UES y Correo Uruguayo cubren todo el país en 24-72h.",
    intro: "Uruguay compra online con confianza — un catálogo profesional con envío claro compite de igual a igual con las tiendas grandes.",
  },
  {
    name: "República Dominicana", demonym: "dominicanos", slug: "republica-dominicana",
    currency: "pesos dominicanos",
    currencyNote: "Los precios van en pesos dominicanos (RD$). Si vendes también a la diáspora, aclara cómo manejas pagos desde el exterior.",
    payMethods: [
      ["Transferencia bancaria", "Popular, BHD y Banreservas"],
      ["Depósito bancario", "para clientes sin banca digital"],
      ["Efectivo contra entrega", "el método de confianza número uno"],
    ],
    shipping: "Vimenpaq y couriers locales conectan el país; en Santo Domingo y Santiago, delivery en moto el mismo día.",
    intro: "El comercio dominicano vive entre WhatsApp e Instagram: el catálogo con precios visibles es lo que convierte seguidores en pedidos.",
  },
];

const buildCountryArticle = (c: CountryData): BlogArticle => ({
  slug: `como-crear-un-catalogo-digital-gratis-en-${c.slug}-2026`,
  category: "por-pais",
  title: `Cómo crear un catálogo digital gratis en ${c.name} (2026)`,
  metaTitle: `Cómo crear un catálogo digital gratis en ${c.name} 2026 | CatalogoHoy`,
  metaDescription: `Crea gratis tu catálogo digital en ${c.name}: productos con precios en ${c.currency}, pedidos por WhatsApp y cobros con ${c.payMethods[0][0]}. Guía 2026 paso a paso.`,
  excerpt: `La guía para negocios ${c.demonym}: catálogo con enlace propio, precios en ${c.currency} y pedidos directo al WhatsApp.`,
  author: "Equipo de CatalogoHoy",
  date: "2026-08-27",
  readMinutes: 7,
  coverTitle: `Catálogo digital gratis en ${c.name}`,
  coverAccent: `en ${c.name}`,
  coverTagline: "Guía paso a paso 2026",
  keyPoints: [
    `Un catálogo digital con enlace propio te permite vender por WhatsApp en ${c.name} sin invertir en una tienda online.`,
    `Puedes crearlo gratis hoy: hasta 10 productos con foto, precio en ${c.currency} y pedidos que llegan armados a tu WhatsApp.`,
    `${c.payMethods[0][0]} y los demás métodos locales se configuran en el catálogo para que el cliente sepa cómo pagar antes de pedir.`,
    "El precio visible es la regla de oro: responde la pregunta que el 90% hace por interno y filtra a los curiosos.",
    "El mismo enlace sirve para WhatsApp, la bio de Instagram, TikTok y un QR impreso en tu local.",
  ],
  blocks: [
    { type: "p", html: `${c.intro} En esta guía creamos tu catálogo digital gratis, ajustado a cómo se vende y se cobra en ${c.name} en 2026.` },
    { type: "h2", id: "que-necesitas", text: "Qué necesitas para empezar (spoiler: casi nada)" },
    {
      type: "ul",
      items: [
        "Un teléfono con WhatsApp (idealmente WhatsApp Business, que es gratis).",
        "Fotos de tus productos — con la cámara del teléfono y buena luz alcanza.",
        `Tus precios en ${c.currency}, decididos y listos para publicar.`,
        "15-30 minutos para la primera carga.",
      ],
    },
    { type: "h2", id: "paso-a-paso", text: `Crea tu catálogo gratis paso a paso` },
    {
      type: "ol",
      items: [
        `<strong>Crea tu cuenta gratis</strong> en <a href="https://catalogohoy.com">CatalogoHoy</a> — sin tarjeta. Tu enlace queda reservado al instante: <em>tunegocio.catalogohoy.com</em>.`,
        "<strong>Sube tus productos</strong> con foto, precio y variantes (tallas, colores). Si ya los tienes en Excel o en un PDF, impórtalos de una vez.",
        "<strong>Organiza por categorías</strong> (3 a 8 claras) y personaliza logo, colores y descripción del negocio.",
        "<strong>Configura tu WhatsApp de ventas</strong>: cada pedido llega a tu chat con productos, cantidades y total calculado.",
        "<strong>Comparte el enlace</strong> por WhatsApp, estados, la bio de Instagram/TikTok y un QR en tu local.",
      ],
    },
    { type: "h2", id: "precios-moneda", text: `Precios en ${c.currency}: hazlo fácil para el cliente` },
    { type: "p", html: c.currencyNote },
    {
      type: "cta",
      title: `Crea tu catálogo gratis para ${c.name}`,
      text: "Hasta 10 productos gratis, sin tarjeta. Comparte tu enlace hoy y recibe pedidos ordenados por WhatsApp.",
      button: "Crear mi catálogo gratis",
    },
    { type: "h2", id: "cobros", text: `Cómo cobrar: los métodos que usan los negocios en ${c.name}` },
    {
      type: "p",
      html: `Configura tus métodos de pago en el catálogo para que el cliente sepa cómo pagar <em>antes</em> de confirmar el pedido — es la diferencia entre cerrar en un mensaje o en veinte. Los más usados por los negocios ${c.demonym}:`,
    },
    { type: "ul", items: c.payMethods.map(([name, how]) => `<strong>${name}:</strong> ${how}.`) },
    { type: "h2", id: "envios", text: "Envíos y entregas" },
    { type: "p", html: `${c.shipping} En tu catálogo puedes configurar tus zonas y tarifas de envío (o "a consultar" para cotizar por WhatsApp), y el costo se suma solo al pedido.` },
    { type: "h2", id: "despegar", text: "3 jugadas para despegar en tu primera semana" },
    {
      type: "ol",
      items: [
        "<strong>Pon el enlace en todos lados:</strong> bienvenida de WhatsApp Business, bio de Instagram/TikTok y tus estados de la semana.",
        "<strong>Responde toda pregunta de precio con el enlace</strong> — entrenas a tus clientes a mirar el catálogo primero.",
        "<strong>Publica 2-3 estados por semana</strong> con productos del catálogo y su enlace directo (cada producto tiene el suyo).",
      ],
    },
    {
      type: "cta",
      title: "Tu negocio merece verse profesional",
      text: `Únete a los negocios de ${c.name} y toda Latinoamérica que ya venden con su catálogo propio.`,
      button: "Empezar gratis",
    },
  ],
  faqs: [
    {
      q: `¿Crear el catálogo es realmente gratis en ${c.name}?`,
      a: "Sí. El plan gratuito de CatalogoHoy incluye hasta 10 productos, tu enlace propio y pedidos por WhatsApp, sin tarjeta de crédito. Cuando el negocio crece, los planes pagos amplían productos y funciones.",
    },
    {
      q: `¿Puedo poner mis precios en ${c.currency}?`,
      a: `Sí, configuras la moneda de tu país y los precios se muestran en ${c.currency} tal como los escribes.`,
    },
    {
      q: `¿Cómo me pagan mis clientes?`,
      a: `Tú eliges y publicas tus métodos: ${c.payMethods.map(([n]) => n).join(", ")}. El cliente ve las opciones al hacer su pedido y coordinan el pago por WhatsApp.`,
    },
    {
      q: "¿Necesito conocimientos técnicos?",
      a: "No. Si sabes usar WhatsApp, sabes usar el catálogo: subes fotos y precios, y la página se arma sola con un diseño profesional.",
    },
    {
      q: "¿Sirve si vendo por Instagram o TikTok?",
      a: "Sí. El mismo enlace va en la bio de tus redes, y todos los pedidos te llegan igual al WhatsApp.",
    },
  ],
  sources: [
    "Adopción de pagos digitales y mensajería en Latinoamérica — reportes públicos de bancos centrales y GSMA",
  ],
});

export const COUNTRY_ARTICLES: BlogArticle[] = COUNTRIES.map(buildCountryArticle);
