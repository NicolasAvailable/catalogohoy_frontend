export type PermissionModule = 'catalogo' | 'ordenes' | 'analiticas' | 'tasas' | 'productos' | 'equipo';
export type PermissionAction = 'view' | 'create' | 'edit' | 'delete' | 'invite';
export type PermissionKey = `${PermissionModule}:${PermissionAction}`;

export const MODULE_ACTIONS: Record<PermissionModule, PermissionAction[]> = {
  catalogo:   ['edit'],
  ordenes:    ['view', 'create', 'edit', 'delete'],
  analiticas: ['view'],
  tasas:      ['edit'],
  productos:  ['view', 'create', 'edit', 'delete'],
  equipo:     ['view', 'invite', 'edit', 'delete'],
};

export const MODULE_LABELS: Record<PermissionModule, string> = {
  catalogo:   'Catálogo',
  ordenes:    'Órdenes',
  analiticas: 'Analíticas',
  tasas:      'Tasas del día',
  productos:  'Productos',
  equipo:     'Equipo',
};

export const ACTION_LABELS: Record<PermissionAction, string> = {
  view:   'Ver',
  create: 'Crear',
  edit:   'Editar',
  delete: 'Eliminar',
  invite: 'Invitar',
};
