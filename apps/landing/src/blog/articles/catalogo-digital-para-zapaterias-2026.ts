import type { BlogArticle } from "../types";

export const catalogoParaZapaterias2026: BlogArticle = {
  slug: "catalogo-digital-para-zapaterias-2026",
  category: "por-rubro",
  title: "Catálogo digital para zapaterías: vende zapatos por WhatsApp sin el \"¿tienes 38?\"",
  metaTitle: "Catálogo digital para zapaterías: guía 2026",
  metaDescription:
    "Cómo vender zapatos por WhatsApp con un catálogo digital: numeración con stock por talla, precios al detal y al por mayor, y pedidos que llegan listos.",
  excerpt:
    "La numeración con stock por talla, el detal y el mayoreo en un mismo enlace, y el fin del \"¿tienes 38?\": la guía del catálogo digital para zapaterías.",
  author: "Equipo de CatalogoHoy",
  date: "2026-10-09",
  readMinutes: 9,
  coverTitle: "Catálogo digital para zapaterías",
  coverAccent: "zapaterías",
  coverTagline: "Guía por rubro 2026",
  keyPoints: [
    "El \"¿tienes 38?\" es el cuello de botella de vender zapatos por chat: la numeración como variantes con stock por talla lo responde solo.",
    "Cada modelo es un producto; cada número (y color) es una variante con su propia foto y su propio inventario, que se descuenta con cada venta.",
    "Si vendes al detal y al por mayor, no necesitas dos listas: los precios por cantidad muestran el precio mayorista cuando el pedido llega al mínimo.",
    "Las fotos se hacen con el celular: par completo en ángulo 3/4, suela y detalle de material, siempre sobre el mismo fondo.",
    "El pedido llega a tu WhatsApp con modelo, número, cantidad y total calculado — y queda registrado en tu panel de órdenes.",
  ],
  blocks: [
    {
      type: "p",
      html: "Todo el que vende zapatos por WhatsApp o redes conoce la secuencia: publicas un modelo, llega el mensaje — \"¿tienes 38?\" —, vas al estante o a la hoja de cálculo, respondes, y la clienta contesta \"¿y en 37?\". Multiplica eso por cada modelo y cada día del mes. Un <strong>catálogo digital para zapatería</strong> rompe el ciclo: cada modelo muestra su numeración disponible con stock real por talla, el precio al detal y, si vendes al mayor, el precio por cantidad. El cliente elige su número y te llega el pedido armado. Aquí va la guía completa para este rubro.",
    },
    { type: "h2", id: "el-problema", text: "Vender zapatos por chat: el día a día sin catálogo" },
    {
      type: "p",
      html: "El calzado es de los rubros más castigados por la venta a puro chat, porque <strong>cada venta depende de una talla específica</strong>:",
    },
    {
      type: "ul",
      items: [
        "<strong>El \"¿tienes 38?\" eterno:</strong> cada consulta exige revisar el inventario antes de responder — y si tardas, la venta se enfría.",
        "<strong>Vender el número que ya salió:</strong> la clienta paga por las sandalias en 37 que se vendieron ayer en el local, y toca devolver el dinero.",
        "<strong>La numeración en la memoria:</strong> \"del deportivo blanco me queda 40 y 42, del botín creo que 38...\" — nadie puede sostener eso con 50 modelos.",
        "<strong>Dos listas de precios paralelas:</strong> una para el detal y otra para mayoristas, cada una en un PDF distinto que envejece con el primer ajuste.",
        "<strong>Pedidos mayoristas a mano:</strong> \"mándame 6 pares surtidos del modelo X\" y empieza el ida y vuelta de números, totales y confirmaciones.",
      ],
    },
    {
      type: "p",
      html: "El catálogo digital no reemplaza tu WhatsApp — lo descarga de trabajo. La consulta de talla, que es el 80% de tus mensajes, la responde el catálogo; a tu chat llegan los pedidos listos y las preguntas que de verdad necesitan a una persona.",
    },
    { type: "h2", id: "numeracion", text: "La numeración como variantes: stock por talla, adiós al \"¿tienes 38?\"" },
    {
      type: "p",
      html: "La estructura correcta en calzado es una sola: <strong>cada modelo es un producto, cada número es una variante</strong>. Nada de crear \"Botín Dakota 36\", \"Botín Dakota 37\" como productos separados (el catálogo se vuelve una lista infinita), ni un producto sin tallas que obliga a preguntar. Con variantes, el producto \"Botín Dakota\" tiene sus números — 35 al 40 — y <strong>cada uno con su propio stock</strong>. ¿El modelo viene en dos colores? Las variantes combinan número y color, cada combinación con su foto, para que la clienta vea el botín miel cuando elige miel.",
    },
    {
      type: "p",
      html: "Lo decisivo es lo que pasa después: <strong>el stock se descuenta solo por variante con cada venta</strong>. Se vendió el último 38, y el 38 aparece agotado al instante — mientras el 36, el 37 y el 39 siguen a la venta. El cliente ya no pregunta si tienes su número: lo ve. Y tú dejas de vender pares que ya no existen.",
    },
    {
      type: "table",
      headers: ["Campo de la ficha", "Ejemplo", "Por qué importa"],
      rows: [
        ["Nombre descriptivo", "Botín Dakota cuero — mujer", "\"Ref. 204\" no se busca; \"botín de cuero mujer\" sí."],
        ["Variantes por número", "35, 36, 37, 38, 39, 40", "El cliente elige su talla y ve solo lo disponible."],
        ["Stock por variante", "37: 3 pares, 38: 1 par", "El número agotado se marca solo; cero ventas fantasma."],
        ["Precio visible", "$28 al detal", "El \"precio por interno\" espanta a la mitad de los compradores."],
        ["Precio por cantidad", "Desde 6 pares: $21 c/u", "El mayorista ve su precio sin pedir la \"otra lista\"."],
        ["Descripción útil", "Cuero genuino, suela antideslizante, horma normal", "La duda de horma (¿talla grande o chico?) genera más devoluciones que el color."],
      ],
    },
    {
      type: "p",
      html: "Un consejo de ficha: <strong>di siempre cómo talla el modelo</strong> (\"horma normal\", \"talla un número grande\"). Es la información que más devoluciones evita en calzado, y casi nadie la pone.",
    },
    { type: "h2", id: "mayoreo", text: "Al detal y al por mayor en el mismo catálogo" },
    {
      type: "p",
      html: "Muchas zapaterías viven de los dos mundos: el cliente final que compra un par y la revendedora o tienda de barrio que compra por docenas. Mantener dos listas de precios separadas es doble trabajo y fuente de errores — el clásico \"me pasaron la lista del detal\" en plena negociación mayorista.",
    },
    {
      type: "p",
      html: "Con los <strong>precios al por mayor por cantidad</strong> el catálogo resuelve ambos en un solo enlace: defines el precio unitario y el precio que se activa a partir de cierta cantidad (por ejemplo, desde 6 o 12 pares). El cliente final ve su precio de siempre; el mayorista arma su pedido grande y <strong>el descuento se aplica solo al llegar al mínimo</strong>, con el total calculado. Nadie pide \"la otra lista\" y tú no cotizas a mano pedido por pedido.",
    },
    {
      type: "cta",
      title: "Tu vitrina de zapatos con numeración real",
      text: "Sube tus modelos con tallas y stock por número, define precios al detal y al mayor, y comparte un solo enlace. Gratis, sin tarjeta.",
      button: "Crear mi catálogo de zapatos",
    },
    { type: "h2", id: "fotos", text: "Fotos de calzado con el celular: el kit mínimo" },
    {
      type: "p",
      html: "En calzado la foto decide, y no hace falta estudio. Tres tomas por modelo bastan: <strong>el par en ángulo 3/4</strong> (la foto principal, la que muestra la forma), <strong>el detalle de material o costuras</strong> (la que da confianza en la calidad) y, en deportivos o botas, <strong>la suela</strong> (la que el comprador técnico siempre pide). Luz natural de una ventana, el mismo fondo claro en todos los modelos, y el catálogo entero se ve de marca, no de bazar.",
    },
    {
      type: "p",
      html: "Si quieres el paso a paso completo — luz, ángulos, trípode casero y errores típicos —, está en la guía de <a href=\"/blog/catalogo-digital/como-tomar-fotos-de-producto-con-el-celular-2026\">cómo tomar fotos de producto con el celular</a>. Y para unificar fotos tomadas en fondos distintos, el <a href=\"/quita-fondo-de-fotos-de-producto\">quita fondo gratis con IA</a> deja todos los pares sobre el mismo fondo limpio en segundos.",
    },
    { type: "h2", id: "pedidos", text: "Pedidos que llegan listos y un panel para despachar con orden" },
    {
      type: "p",
      html: "Cuando el cliente confirma su carrito, a tu WhatsApp llega <strong>un solo mensaje con todo</strong>: modelo, número, color, cantidad de pares, total calculado y los datos del comprador. En mayoreo esto vale doble — un pedido de 18 pares surtidos en cinco modelos, que por chat serían veinte mensajes, llega como una orden limpia y sin errores de transcripción.",
    },
    {
      type: "p",
      html: "Cada pedido queda además en tu <strong>panel de órdenes</strong>: ves el historial, marcas estados y cuadras el día sin buscar en el chat. Y como el stock por talla se descontó solo al confirmar, el inventario publicado sigue siendo el real — también si vendes en local físico y descuentas desde el panel.",
    },
    { type: "h2", id: "planes", text: "Qué plan le conviene a una zapatería" },
    {
      type: "p",
      html: "En calzado el número a mirar son las <strong>variantes por producto</strong>, porque cada modelo necesita su curva de numeración:",
    },
    {
      type: "table",
      headers: ["Plan", "Precio", "Productos", "Variantes por producto", "Para quién"],
      rows: [
        ["Gratis", "$0 para siempre", "10 productos, 1 catálogo", "1", "Probar la plataforma con tus modelos estrella."],
        ["Básico", "$11.99/mes", "100 productos", "3", "Catálogo corto con pocas tallas por modelo."],
        ["Pro", "$19.99/mes (prueba 7 días)", "500 productos", "10", "La zapatería típica: curva 35-40 en uno o dos colores. El más popular."],
        ["Avanzado", "$34.99/mes (prueba 7 días)", "Ilimitados", "15", "Curvas completas 34-44, venta en mostrador con POS y chats de WhatsApp/Instagram/TikTok en una bandeja."],
      ],
    },
    {
      type: "p",
      html: "Para la mayoría de las zapaterías el <strong>Pro</strong> es el punto de partida: 10 variantes cubren una curva de seis números en dos colores. Si manejas curvas largas de caballero (del 38 al 44 en varios colores) o vendes también en mostrador, el <strong>Avanzado</strong> suma 15 variantes por producto y el punto de venta (POS) sobre el mismo inventario. Compara los detalles en la <a href=\"/pricing\">página de precios</a>.",
    },
    { type: "h2", id: "empezar", text: "Cómo empezar esta semana" },
    {
      type: "ol",
      items: [
        "Crea tu cuenta gratis en <a href=\"https://auth.catalogohoy.com/signup\">auth.catalogohoy.com/signup</a> y reserva tu enlace (tuzapateria.catalogohoy.com).",
        "Sube tus 10 modelos de más rotación con sus variantes de número y el stock real de cada talla.",
        "Toma las tres fotos por modelo (3/4, detalle, suela) con luz natural y el mismo fondo.",
        "Si vendes al mayor, configura los precios por cantidad con tu mínimo de pares.",
        "Organiza las categorías: \"Damas\", \"Caballeros\", \"Niños\", \"Deportivos\", \"Ofertas\".",
        "Configura tu WhatsApp de ventas y comparte el enlace: cada \"¿tienes 38?\" se responde con el link del modelo.",
      ],
    },
    {
      type: "p",
      html: "La regla de oro del rubro: <strong>la talla la consulta el catálogo, la venta la cierras tú</strong>. Asesorar sobre horma, recomendar el modelo para cada uso, negociar el pedido mayorista grande — ahí aportas valor. El \"¿tienes 38?\", que lo conteste el enlace.",
    },
    {
      type: "cta",
      title: "Que el 38 se consulte solo",
      text: "Crea tu catálogo de calzado gratis: numeración con stock por talla, precios al detal y al mayor, y pedidos listos en tu WhatsApp.",
      button: "Empezar gratis",
    },
  ],
  faqs: [
    {
      q: "¿Cómo pongo la numeración de cada modelo de zapato?",
      a: "Como variantes de un mismo producto: creas el modelo una sola vez (por ejemplo \"Botín Dakota\") y agregas cada número como variante con su propio stock. Si viene en varios colores, la variante combina número y color, y puede tener su propia foto. El cliente elige su talla y solo ve lo disponible.",
    },
    {
      q: "¿El cliente puede ver si queda su número sin preguntarme?",
      a: "Sí. El stock se maneja por variante: cuando se vende el último par en 38, ese número aparece agotado automáticamente en el catálogo, mientras las demás tallas siguen a la venta. Es la pregunta más repetida del rubro y el catálogo la responde solo, a cualquier hora.",
    },
    {
      q: "Vendo al detal y al por mayor, ¿necesito dos catálogos?",
      a: "No, uno solo. Con los precios por cantidad defines el precio unitario y el precio mayorista que se activa desde cierto número de pares (por ejemplo, desde 6 o 12). El cliente final ve su precio normal y el mayorista obtiene su descuento automáticamente al armar el pedido grande.",
    },
    {
      q: "¿El stock se descuenta cuando vendo?",
      a: "Sí, automáticamente y por talla: cada pedido confirmado descuenta los pares vendidos de la variante exacta. Si también vendes en tu local, descuentas desde el panel y el catálogo online queda cuadrado con el inventario real.",
    },
    {
      q: "¿Qué fotos necesito para vender zapatos online?",
      a: "Tres por modelo, tomadas con el celular: el par en ángulo 3/4 como foto principal, un detalle del material y la suela en deportivos o botas. Usa luz natural y el mismo fondo en todos los modelos; si tus fotos tienen fondos distintos, la herramienta gratuita de quitar fondo de CatalogoHoy las unifica en segundos.",
    },
    {
      q: "¿Cómo me llega un pedido mayorista de varios modelos?",
      a: "Como un solo mensaje de WhatsApp con el detalle completo: cada modelo con su número, color y cantidad de pares, el total calculado con el precio por cantidad ya aplicado, y los datos del cliente. El pedido queda también registrado en tu panel de órdenes.",
    },
    {
      q: "¿Cuánto cuesta un catálogo digital para zapatería?",
      a: "Empiezas gratis con 10 productos y tu enlace propio, sin tarjeta. El plan Pro ($19.99/mes, prueba de 7 días) permite 500 productos con hasta 10 variantes cada uno — suficiente para curvas de numeración típicas — y el Avanzado ($34.99/mes) sube a productos ilimitados con 15 variantes y punto de venta para el local.",
    },
  ],
};
