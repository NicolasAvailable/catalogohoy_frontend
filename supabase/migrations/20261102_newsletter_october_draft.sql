-- Primer número: Novedades de octubre 2026 (borrador, sin enviar).
-- Imágenes en assets/newsletter/2026-10/ del repo (servidas desde GitHub raw
-- de main); se pueden reemplazar subiendo otras desde el panel interno.
insert into public.newsletter_issues (kind, period_start, period_end, subject, title, intro, sections, outro)
values (
  'monthly', '2026-10-01', '2026-10-31',
  'Octubre en CatalogoHoy: apps móviles, Asistente de WhatsApp y más 🚀',
  'Lo nuevo en CatalogoHoy · Octubre 2026',
  'Octubre fue nuestro mes más grande. Esto es lo nuevo:',
  $json$[
    {"emoji": "🚀", "title": "Nuevas funcionalidades", "items": [
      {"title": "📱 Apps para iPhone y Android", "text": "Maneja tu tienda desde el celular. Búscanos como CatalogoHoy en el App Store y Google Play.",
       "image": "https://raw.githubusercontent.com/NicolasAvailable/catalogohoy_frontend/main/assets/newsletter/2026-10/apps-moviles.jpg"},
      {"title": "🤖 Asistente de WhatsApp (beta)", "text": "Crea productos con una foto, registra ventas y pregúntale cuánto vendiste, todo desde WhatsApp. Actívalo en Asistente WhatsApp.",
       "image": "https://raw.githubusercontent.com/NicolasAvailable/catalogohoy_frontend/main/assets/newsletter/2026-10/asistente-whatsapp.jpg"},
      {"title": "🗂️ Estados de orden y vista Tablero", "text": "Crea tus propios estados y mueve tus órdenes arrastrándolas entre columnas.",
       "image": "https://raw.githubusercontent.com/NicolasAvailable/catalogohoy_frontend/main/assets/newsletter/2026-10/tablero.jpg"},
      {"title": "🧾 Punto de venta sin internet", "text": "Sigue vendiendo aunque se caiga la conexión y cobra una venta con varios métodos de pago.",
       "image": "https://raw.githubusercontent.com/NicolasAvailable/catalogohoy_frontend/main/assets/newsletter/2026-10/pos-sin-internet.jpg"},
      {"title": "📸 Instagram y Facebook", "text": "Conecta tu tienda con Meta en un clic: catálogo en Instagram y Facebook y píxel para tus anuncios."},
      {"title": "🧮 IVA en recibos y facturas", "text": "Configura tu impuesto y verás base, IVA y total. Recibos en 58 mm, 80 mm o carta."},
      {"title": "📊 Métricas más completas", "text": "Ganancia por orden, ingresos por método de pago y tus productos más vendidos."}
    ]},
    {"emoji": "🔧", "title": "Ajustes y mejoras", "items": [
      {"title": "Tus clientes pueden ver el stock y escribir la cantidad a mano", "text": ""},
      {"title": "Búsqueda del catálogo que entiende acentos y errores de escritura", "text": ""},
      {"title": "El carrito revisa precios y stock antes de comprar", "text": ""},
      {"title": "Importa productos desde el celular o por WhatsApp", "text": ""},
      {"title": "Exporta tus productos a CSV", "text": ""},
      {"title": "Nuevos permisos de equipo para POS, Instagram/Facebook y el asistente", "text": ""},
      {"title": "Escanea códigos con la cámara también en Windows", "text": ""},
      {"title": "Tus fotos cargan más rápido", "text": ""}
    ]}
  ]$json$::jsonb,
  'Adelanto de noviembre: ya puedes llevar tus gastos y facturas en el panel. ¿Tienes una idea? Responde este correo.'
)
on conflict (kind, period_start) do nothing;
