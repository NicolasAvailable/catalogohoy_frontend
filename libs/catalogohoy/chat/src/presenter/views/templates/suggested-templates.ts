/** Plantillas sugeridas por CatalogoHoy: cubren el ciclo real de un comercio
 *  (retomar consulta → pedido → pago → post-venta → reactivación). El
 *  comerciante las envía a revisión de Meta con un clic (o las edita antes).
 *
 *  Categorías honestas: las ligadas a un pedido concreto van como UTILITY (más
 *  baratas y de aprobación fácil); saludos/reactivación van como MARKETING —
 *  el clasificador de Meta las recategoriza igual si se intenta colarlas. */
export interface SuggestedTemplate {
  /** Nombre con el que se crea en Meta (minúsculas + guion bajo). */
  key: string;
  /** Título legible para la galería. */
  title: string;
  /** Cuándo conviene usarla. */
  description: string;
  category: 'UTILITY' | 'MARKETING';
  body: string;
  /** Un ejemplo por variable {{n}}, en orden — Meta los exige. */
  examples: string[];
}

export const SUGGESTED_TEMPLATES: SuggestedTemplate[] = [
  {
    key: 'inicio_conversacion',
    title: 'Retomar una consulta',
    description:
      'Para escribirle a un cliente que dejó su número o cuya conversación ya venció.',
    category: 'MARKETING',
    body: 'Hola {{1}} 👋, te escribimos de {{2}}. Queríamos retomar tu consulta, ¿te podemos ayudar con algo?',
    examples: ['María', 'Tienda Central'],
  },
  {
    key: 'pedido_recibido',
    title: 'Pedido recibido',
    description: 'Confirma al cliente que su pedido entró correctamente.',
    category: 'UTILITY',
    body: 'Hola {{1}}, recibimos tu pedido #{{2}} en {{3}} ✅. Te avisaremos apenas esté listo. ¡Gracias por tu compra!',
    examples: ['María', '1024', 'Tienda Central'],
  },
  {
    key: 'pedido_listo',
    title: 'Pedido listo',
    description: 'Avisa que el pedido está listo para retirar o despachar.',
    category: 'UTILITY',
    body: 'Hola {{1}}, ¡buenas noticias! Tu pedido #{{2}} de {{3}} ya está listo 🎉. Escríbenos para coordinar la entrega.',
    examples: ['María', '1024', 'Tienda Central'],
  },
  {
    key: 'pedido_en_camino',
    title: 'Pedido en camino',
    description: 'Avisa que el pedido salió hacia la dirección del cliente.',
    category: 'UTILITY',
    body: 'Hola {{1}}, tu pedido #{{2}} de {{3}} ya va en camino 🚚. Cualquier duda, responde este mensaje.',
    examples: ['María', '1024', 'Tienda Central'],
  },
  {
    key: 'pago_pendiente',
    title: 'Recordatorio de pago',
    description: 'Recuerda un pedido que sigue pendiente de pago.',
    category: 'UTILITY',
    body: 'Hola {{1}}, te recordamos que tu pedido #{{2}} en {{3}} sigue pendiente de pago. Si ya lo pagaste, ignora este mensaje. ¿Te ayudamos a completarlo?',
    examples: ['María', '1024', 'Tienda Central'],
  },
  {
    key: 'gracias_por_tu_compra',
    title: 'Agradecimiento post-venta',
    description:
      'Agradece la compra y queda a disposición — fideliza y reabre la ventana de 24 h.',
    category: 'MARKETING',
    body: 'Hola {{1}}, ¡gracias por tu compra en {{2}}! 🙌 ¿Cómo salió todo? Si necesitas algo más, responde este mensaje y con gusto te ayudamos.',
    examples: ['María', 'Tienda Central'],
  },
  {
    key: 'novedades_catalogo',
    title: 'Novedades del catálogo',
    description: 'Reactiva clientes contándoles que hay productos nuevos.',
    category: 'MARKETING',
    body: 'Hola {{1}} 👋, en {{2}} tenemos novedades en el catálogo que te pueden gustar. Míralas aquí: {{3}}. Si prefieres no recibir novedades, avísanos por este chat.',
    examples: ['María', 'Tienda Central', 'https://tienda.catalogohoy.com'],
  },
];
