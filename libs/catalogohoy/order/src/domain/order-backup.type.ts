/** Metadatos de un respaldo de órdenes (fila de `order_backups`). El snapshot
 *  completo (array de órdenes crudas, snake_case) se trae aparte con
 *  `getSnapshot` y se mapea con `OrderMapper.toDomain` para ver/descargar. */
export interface OrderBackup {
  id: number;
  createdAt: string;
  /** Por qué se creó: 'manual' (botón), 'pre-restore' (antes de restaurar). */
  reason: string;
  orderCount: number;
}
