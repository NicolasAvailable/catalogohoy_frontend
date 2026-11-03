import type { BlogArticle } from "../types";

/** Novedades del mes (changelog para clientes). Mismo contenido que la
 *  newsletter mensual (panel interno → Newsletter), en formato blog. */
export const novedadesOctubre2026: BlogArticle = {
  slug: "novedades-catalogohoy-octubre-2026",
  category: "novedades",
  title: "Novedades de CatalogoHoy: todo lo nuevo de octubre 2026",
  metaTitle: "Novedades de CatalogoHoy octubre 2026 | Apps y Asistente",
  metaDescription:
    "Todo lo nuevo de CatalogoHoy en octubre 2026: apps para iPhone y Android, Asistente de WhatsApp, estados de orden con Tablero, POS sin internet y más.",
  excerpt:
    "Apps para iPhone y Android, el Asistente de WhatsApp, estados de orden con vista Tablero, POS sin internet y decenas de mejoras.",
  author: "Equipo de CatalogoHoy",
  date: "2026-11-03",
  readMinutes: 4,
  coverTitle: "Novedades de octubre",
  coverAccent: "octubre",
  coverTagline: "Lo nuevo en CatalogoHoy",
  keyPoints: [
    "Lanzamos las apps de CatalogoHoy para iPhone y Android: tu tienda completa desde el celular.",
    "El Asistente de WhatsApp (beta) crea productos con una foto, registra ventas y te dice cuánto vendiste.",
    "Ahora puedes crear tus propios estados de orden y moverlas arrastrándolas en la vista Tablero.",
    "El punto de venta sigue funcionando sin internet y acepta pagos con varios métodos en una misma venta.",
    "Más de una docena de ajustes: stock visible en el catálogo, búsqueda más inteligente, exportar a CSV y más.",
  ],
  blocks: [
    {
      type: "p",
      html: "Octubre fue el mes más grande en la historia de CatalogoHoy. Lanzamos las apps móviles, el Asistente de WhatsApp y muchas mejoras que nos pidieron ustedes, los comerciantes que usan la plataforma todos los días. Aquí tienes el resumen de las <strong>novedades de CatalogoHoy en octubre 2026</strong>.",
    },
    { type: "h2", id: "nuevas-funcionalidades", text: "🚀 Nuevas funcionalidades" },
    { type: "h3", text: "📱 Apps para iPhone y Android" },
    {
      type: "p",
      html: "Ya puedes manejar tu tienda desde el celular: productos, órdenes, clientes y métricas. Búscanos como <strong>CatalogoHoy</strong> en el <a href=\"https://apps.apple.com/us/app/catalogohoy-cat%C3%A1logo-y-ventas/id6817059692?l=es-MX\">App Store</a> y en <a href=\"https://play.google.com/store/apps/details?id=com.catalogohoy.app\">Google Play</a>, y entra con tu misma cuenta.",
    },
    { type: "img", src: "/blog/novedades/2026-10/apps-moviles.jpg", alt: "App de CatalogoHoy en un iPhone mostrando la lista de órdenes" },
    { type: "h3", text: "🤖 Asistente de WhatsApp (beta)" },
    {
      type: "p",
      html: "Escríbele al asistente como le escribirías a un empleado. Mándale una foto con el nombre y el precio y crea el producto; pídele que registre una venta o pregúntale cuánto vendiste esta semana. Entiende notas de voz, fotos, PDF y Excel, y puede editar muchos productos de una vez. Se activa en <strong>Asistente WhatsApp</strong>, dentro de tu panel.",
    },
    { type: "img", src: "/blog/novedades/2026-10/asistente-whatsapp.jpg", alt: "Chat de WhatsApp con el asistente de CatalogoHoy creando un producto a partir de una foto" },
    { type: "h3", text: "🗂️ Estados de orden y vista Tablero" },
    {
      type: "p",
      html: "Crea tus propios estados (por ejemplo \"Revisión\" o \"Despachado\"), cámbiales el nombre o el color a los de siempre y decide si descuentan stock o cuentan como venta. En la vista <strong>Tablero</strong> ves tus órdenes por columnas y las mueves arrastrándolas.",
    },
    { type: "img", src: "/blog/novedades/2026-10/tablero.jpg", alt: "Vista Tablero de órdenes con columnas Pendiente, Revisión, Despachado y Completada" },
    { type: "h3", text: "🧾 Punto de venta sin internet" },
    {
      type: "p",
      html: "Si se cae la conexión, sigues vendiendo: todo se guarda y se sincroniza solo cuando vuelve el internet. Además puedes cobrar una misma venta con varios métodos, por ejemplo parte en efectivo y parte en pago móvil.",
    },
    { type: "img", src: "/blog/novedades/2026-10/pos-sin-internet.jpg", alt: "Punto de venta de CatalogoHoy funcionando sin internet" },
    { type: "h3", text: "📸 Instagram y Facebook para todas las tiendas" },
    {
      type: "p",
      html: "Conecta tu tienda con Meta en un clic: tus productos en el catálogo de Instagram y Facebook (plan Avanzado) y el píxel listo para tus anuncios.",
    },
    { type: "h3", text: "🧮 IVA en recibos y facturas" },
    {
      type: "p",
      html: "Configura tu impuesto y verás base, IVA y total en recibos, facturas y checkout. Te sugerimos el de tu país, y puedes imprimir recibos en 58 mm, 80 mm, media carta o carta.",
    },
    { type: "h3", text: "📊 Métricas más completas" },
    {
      type: "p",
      html: "Ve la ganancia de cada orden, cuánto entró por cada método de pago y cuáles son tus productos más vendidos. Las órdenes canceladas ya no suman.",
    },
    {
      type: "cta",
      title: "¿Todavía no tienes tu catálogo?",
      text: "Crea tu catálogo gratis y prueba todas estas novedades hoy mismo.",
      button: "Crear mi catálogo gratis",
    },
    { type: "h2", id: "ajustes-y-mejoras", text: "🔧 Ajustes y mejoras" },
    {
      type: "ul",
      items: [
        "Tus clientes pueden ver el stock y escribir la cantidad a mano en tu catálogo.",
        "La búsqueda del catálogo entiende acentos, errores de escritura y palabras en otro orden.",
        "El carrito revisa precios y stock antes de comprar, para que no te lleguen pedidos de productos agotados.",
        "Importa productos desde el celular o por WhatsApp; la IA encuentra sola los encabezados de tu Excel.",
        "Exporta tus productos a CSV además de Excel.",
        "Nuevos permisos de equipo para el POS, Instagram/Facebook y el Asistente de WhatsApp.",
        "Escanea códigos de barra con la cámara también en Windows.",
        "Tus fotos cargan más rápido desde nuestro nuevo servidor.",
      ],
    },
    { type: "h2", id: "lo-que-viene", text: "Lo que viene" },
    {
      type: "p",
      html: "Noviembre arranca con <strong>Gastos y facturas</strong>, para que lleves tus gastos y veas cuánto te queda de verdad cada mes. ¿Tienes una idea o algo que te gustaría ver en CatalogoHoy? Escríbenos: muchas de estas mejoras salieron de mensajes de nuestros clientes.",
    },
  ],
  faqs: [
    {
      q: "¿Las apps de CatalogoHoy tienen costo adicional?",
      a: "No. Las apps para iPhone y Android son gratis y usan tu misma cuenta y tu mismo plan. Todo lo que haces en la app se ve en el panel web y al revés.",
    },
    {
      q: "¿Cómo activo el Asistente de WhatsApp?",
      a: "Entra a tu panel desde la web y abre Asistente WhatsApp. Escanea el código o envía el mensaje de vinculación desde tu WhatsApp y listo: toma menos de un minuto. Cada mensaje usa créditos de IA según lo que le pidas.",
    },
    {
      q: "¿Dónde veo las novedades de CatalogoHoy cada mes?",
      a: "En la sección Novedades del blog y en el correo de novedades que enviamos a las tiendas. Cada mes publicamos el resumen de todo lo nuevo y los ajustes.",
    },
  ],
};
