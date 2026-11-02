-- Primer número: Novedades de octubre 2026 (borrador, sin enviar).
insert into public.newsletter_issues (kind, period_start, period_end, subject, title, intro, sections, outro)
values (
  'monthly', '2026-10-01', '2026-10-31',
  'Novedades de octubre: apps móviles, Asistente de WhatsApp y más 🚀',
  'Lo nuevo en CatalogoHoy · Octubre 2026',
  'Octubre fue nuestro mes más grande: lanzamos las apps para iPhone y Android, el Asistente de WhatsApp y decenas de mejoras que nos pidieron ustedes. Aquí va todo, en corto.',
  $json$[
    {"emoji": "⭐", "title": "Lo más importante del mes", "items": [
      {"title": "Apps para iPhone y Android", "text": "Ya puedes manejar tu tienda desde el celular. Descarga CatalogoHoy en el App Store o en Google Play y entra con tu misma cuenta."},
      {"title": "Asistente de WhatsApp (beta)", "text": "Maneja tu tienda chateando: mándale fotos y precios y crea tus productos, crea y consulta órdenes, pregúntale cuánto vendiste. Entiende notas de voz, fotos, PDF y Excel. Actívalo en Asistente WhatsApp."},
      {"title": "Estados de orden a tu medida + Tablero", "text": "Crea tus propios estados (por ejemplo \"Revisión\" o \"Despachado\") y mueve tus órdenes entre columnas arrastrándolas en la nueva vista Tablero."},
      {"title": "Instagram y Facebook para todas las tiendas", "text": "Conecta tu tienda con Meta en un clic: tus productos en el catálogo de Instagram y Facebook (plan Avanzado) y el píxel para tus anuncios."}
    ]},
    {"emoji": "🤖", "title": "Asistente de WhatsApp: lo que ya sabe hacer", "items": [
      {"title": "Edita muchos productos de una vez", "text": "Cambia un texto en todas tus descripciones, oculta, agota o pon en promoción varios productos con un solo mensaje."},
      {"title": "Configura tu tienda", "text": "Cambia la tasa de cambio, horarios, vendedores de WhatsApp, métodos de pago y de envío sin entrar al panel."},
      {"title": "Ventas por producto y clientes", "text": "Pregúntale cuántas unidades vendiste de un producto o busca a un cliente."},
      {"title": "Te avisa tus créditos", "text": "Cada respuesta te dice cuántos créditos usó y cuántos te quedan."}
    ]},
    {"emoji": "🧾", "title": "Punto de venta (POS)", "items": [
      {"title": "Vende sin internet", "text": "Si se cae la conexión, sigues vendiendo. Todo se sincroniza solo cuando vuelve el internet."},
      {"title": "Pago dividido", "text": "Cobra una misma venta con varios métodos, por ejemplo parte en efectivo y parte en pago móvil."},
      {"title": "IVA e impuestos", "text": "Configura tu impuesto y verás base, IVA y total en recibos, facturas y checkout. Te sugerimos el de tu país."},
      {"title": "Recibos a tu medida", "text": "Imprime en 58 mm, 80 mm, media carta o carta, con documento y dirección del cliente."},
      {"title": "Busca y escanea más rápido", "text": "Agrega productos por código o SKU, escanea con la cámara (también en Windows) y elige la talla dentro de cada variante."}
    ]},
    {"emoji": "📊", "title": "Órdenes y métricas", "items": [
      {"title": "Ganancia por orden", "text": "Ve la ganancia estimada de cada orden y del período en Métricas."},
      {"title": "Ingresos por método de pago", "text": "Cuánto entró por efectivo, pago móvil, punto, Zelle y más."},
      {"title": "Productos más vendidos", "text": "Unidades, ventas y ganancia de tus productos estrella. Las órdenes canceladas ya no suman."},
      {"title": "Busca órdenes más fácil", "text": "Por nombre del cliente, número de orden o SKU."}
    ]},
    {"emoji": "🛍️", "title": "Tu catálogo y tus clientes", "items": [
      {"title": "Mostrar stock", "text": "Elige si tus clientes ven cuántas unidades quedan de cada producto."},
      {"title": "Cantidad a mano", "text": "Tus clientes pueden escribir la cantidad que quieren, no solo usar + y −."},
      {"title": "Búsqueda más inteligente", "text": "Encuentra productos aunque escriban sin acentos, con s/z/c cambiadas o las palabras en otro orden."},
      {"title": "Carrito siempre al día", "text": "Antes de comprar se revisan precios y stock actuales, para que no te lleguen pedidos de cosas agotadas."},
      {"title": "Fotos más rápidas", "text": "Tus imágenes ahora cargan desde nuestro nuevo servidor, más rápido en todo el mundo."}
    ]},
    {"emoji": "📦", "title": "Productos", "items": [
      {"title": "Importa desde el celular o por WhatsApp", "text": "El importador funciona bien en el teléfono y la IA encuentra sola los encabezados de tu Excel, aunque tenga títulos arriba."},
      {"title": "Exporta a CSV", "text": "Además de Excel, ahora puedes bajar tus productos en CSV."},
      {"title": "Stock por talla", "text": "La lista muestra la suma de stock de tus tallas en vez de \"Infinito\", y funciona con tiendas de más de 1.000 productos."}
    ]},
    {"emoji": "👥", "title": "Equipo y cuenta", "items": [
      {"title": "Permisos nuevos para tu equipo", "text": "Decide quién usa el POS, quién conecta Instagram/Facebook y quién usa el Asistente de WhatsApp (en Equipo)."},
      {"title": "Te avisamos si una invitación rebota", "text": "Si el correo de un invitado no existe, te lo decimos para que lo corrijas."},
      {"title": "Empezar es más fácil", "text": "Nuevo asistente de bienvenida con vista previa de tu tienda y métodos de pago según tu país."},
      {"title": "Planes", "text": "Volvió el plan Básico, y Pro y Avanzado tienen 7 días de prueba gratis."}
    ]}
  ]$json$::jsonb,
  'Adelanto de noviembre: ya está disponible Gastos y facturas, para llevar tus gastos y ver cuánto te queda de verdad. ¿Tienes una idea o algo que te gustaría ver? Responde este correo: muchas de estas mejoras salieron de mensajes como el tuyo.'
)
on conflict (kind, period_start) do nothing;
