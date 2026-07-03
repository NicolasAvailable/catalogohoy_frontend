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

  /** Cuántos productos del tenant usan esa imagen (para avisar antes de borrar). */
  async countProductUsage(tenantId: number, url: string): Promise<number> {
    const { data, error } = await this.client.rpc('count_product_photo_usage', {
      p_tenant_id: tenantId,
      p_url: url,
    });
    if (error) return 0;
    return Number(data ?? 0);
  }

  /** Elimina la imagen: la quita del registro y la desvincula de los productos.
   *  Además borra el objeto del Storage (best-effort: si falla, queda huérfano
   *  pero ya no se muestra ni referencia). */
  async deleteImage(
    tenantId: number,
    url: string
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client.rpc('delete_tenant_image', {
      p_tenant_id: tenantId,
      p_url: url,
    });
    if (error) return E.left(new Error(error.message));

    const marker = '/storage/v1/object/public/catalogohoy/';
    const idx = url.indexOf(marker);
    if (idx >= 0) {
      const path = decodeURIComponent(url.slice(idx + marker.length));
      try {
        await this.client.storage.from('catalogohoy').remove([path]);
      } catch {
        /* objeto huérfano, no es crítico */
      }
    }
    return E.right(undefined);
  }

  private toUrls(data: unknown): string[] {
    return ((data ?? []) as { url?: string }[])
      .map((r) => r.url ?? '')
      .filter((u) => !!u);
  }
}
