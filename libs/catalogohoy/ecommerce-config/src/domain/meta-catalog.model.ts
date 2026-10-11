/** Estado del Commerce Catalog del tenant en Meta (CAT-64): lo que ve Meta
 *  tras ingerir el feed, para mostrar en la card "Conectar con Meta". */
export interface MetaCatalogSync {
  catalogId: string;
  /** null si Meta no respondió el conteo (no bloquea la UI). */
  productCount: number | null;
  /** ISO de la última ingesta terminada del feed, si hubo alguna. */
  lastSyncEnd: string | null;
  errorCount: number;
  warningCount: number;
}
