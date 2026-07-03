import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';

/**
 * Galería de imágenes para reusar en el form de producto. Dos fuentes:
 *  - Fotos ya usadas en los productos del tenant (`list_tenant_product_photos`).
 *  - Todas las subidas registradas del tenant (`list_tenant_uploads`).
 * Las subidas se registran con `registerUpload` (best-effort) cada vez que se
 * agrega una imagen al form (upload, IA o reuso). Todo pasa por RPCs
 * SECURITY DEFINER con chequeo de membresía — el Storage es una carpeta plana
 * compartida entre tenants, así que NO se lista directo.
 */
@Injectable({ providedIn: 'root' })
export class ImageGalleryService {
  private readonly client = SupabaseClientProvider.getInstance();

  async listProductPhotos(
    tenantId: number
  ): Promise<E.Either<Error, string[]>> {
    const { data, error } = await this.client.rpc(
      'list_tenant_product_photos',
      { p_tenant_id: tenantId }
    );
    if (error) return E.left(new Error(error.message));
    return E.right(this.toUrls(data));
  }

  async listUploads(tenantId: number): Promise<E.Either<Error, string[]>> {
    const { data, error } = await this.client.rpc('list_tenant_uploads', {
      p_tenant_id: tenantId,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(this.toUrls(data));
  }

  /** Registra una URL como "subida" del tenant. Best-effort: nunca rompe el
   *  flujo (si falla, simplemente no queda en "Todas las subidas"). */
  async registerUpload(tenantId: number, url: string): Promise<void> {
    if (!tenantId || !url) return;
    try {
      await this.client.rpc('register_tenant_upload', {
        p_tenant_id: tenantId,
        p_url: url,
      });
    } catch {
      /* best-effort */
    }
  }

  private toUrls(data: unknown): string[] {
    return ((data ?? []) as { url?: string }[])
      .map((r) => r.url ?? '')
      .filter((u) => !!u);
  }
}
