/** Estado de la lista de verificación previa a conectar WhatsApp Business.
 *  Meta puede revisar el negocio durante el onboarding de la WABA, así que
 *  guiamos al comerciante a dejar su catálogo presentable antes de conectar. */
export interface WhatsAppConnectChecklist {
  /** Productos no ocultos del catálogo (Meta espera ver un negocio real). */
  visibleProducts: number;
  /** El catálogo público está visible (`tenant_ecommerce_config.is_visible`). */
  isCatalogPublic: boolean;
  /** Tiene dominio propio vinculado (opcional, mejora la revisión). */
  hasCustomDomain: boolean;
}
