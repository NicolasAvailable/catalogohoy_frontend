export type PermissionModule =
  | 'catalogo' | 'ordenes' | 'clientes' | 'chats' | 'analiticas' | 'tasas' | 'productos' | 'equipo' | 'reportes'
  | 'pos' | 'meta' | 'asistente';
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'invite' | 'connect' | 'use';
export type PermissionKey = `${PermissionModule}:${PermissionAction}`;

export const MODULE_ACTIONS: Record<PermissionModule, PermissionAction[]> = {
  catalogo:   ['edit'],
  ordenes:    ['view', 'create', 'edit', 'delete'],
  clientes:   ['view'],
  // Chats/CRM: ver y responder la bandeja, gestionar plantillas, conectar canales.
  chats:      ['view', 'edit', 'connect'],
  analiticas: ['view'],
  tasas:      ['edit'],
  productos:  ['view', 'create', 'edit', 'delete'],
  equipo:     ['view', 'invite', 'edit', 'delete'],
  reportes:   ['view', 'create', 'delete'],
  // Punto de venta: abrir el POS y cobrar.
  pos:        ['use'],
  // Instagram y Facebook: ver el canal; conectar/desconectar y publicar el catálogo.
  meta:       ['view', 'connect'],
  // Asistente WhatsApp: ver la conversación; conectar números (el número
  // conectado puede editar productos y órdenes por chat).
  asistente:  ['view', 'connect'],
};

export const MODULE_LABELS: Record<PermissionModule, string> = {
  catalogo:   'Catálogo',
  ordenes:    'Órdenes',
  clientes:   'Clientes',
  chats:      'Chats',
  analiticas: 'Analíticas',
  tasas:      'Tasas del día',
  productos:  'Productos',
  equipo:     'Equipo',
  reportes:   'Reportes',
  pos:        'Punto de venta',
  meta:       'Instagram y Facebook',
  asistente:  'Asistente WhatsApp',
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view:    'Ver',
  create:  'Crear',
  edit:    'Editar',
  delete:  'Eliminar',
  invite:  'Invitar',
  connect: 'Conectar canales',
  use:     'Usar',
};
