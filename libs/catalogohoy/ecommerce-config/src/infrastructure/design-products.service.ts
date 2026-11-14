import { Injectable } from '@angular/core';
import { E } from '../../../../shared/domain/src';
import { SupabaseClientProvider } from '../../../core/src';
import { compressImage, preferredImageFormat, signedUpload } from '@ui';

/** Producto mínimo para el selector de destacados del editor de diseño. */
export interface DesignProductOption {
  id: string;
  name: string;
  price: number;
  photo: string | null;
}

/** Fila de `catalog_themes` (temas del editor de diseño). */
export interface CatalogThemeRow {
  id: string;
  name: string;
  color: string;
  look: Record<string, unknown>;
  is_premium: boolean;
}

/**
 * Lectura liviana de productos para el editor de diseño (CAT-103). Vive acá y
 * no en @catalogohoy/product porque product ya depende de ecommerce-config
 * (importarlo al revés crearía un ciclo).
 */
@Injectable({ providedIn: 'root' })
export class DesignProductsService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Temas visibles del editor (`catalog_themes`, administrados en el panel
   *  interno). RLS solo deja ver los activos. */
  async listThemes(): Promise<E.Either<Error, CatalogThemeRow[]>> {
    const { data, error } = await this.client
      .from('catalog_themes')
      .select('id, name, color, look, is_premium')
      .order('sort_order', { ascending: true });
    if (error) return E.left(new Error(error.message));
    return E.right((data ?? []) as CatalogThemeRow[]);
  }

  /** Lee `tenant_ecommerce_config.design.look` (opciones nuevas de diseño,
   *  CAT-103). null si la tienda nunca las guardó. */
  async getLook(tenantId: number): Promise<E.Either<Error, Record<string, unknown> | null>> {
    const { data, error } = await this.client
      .from('tenant_ecommerce_config')
      .select('design')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error) return E.left(new Error(error.message));
    const design = (data?.design ?? null) as { look?: Record<string, unknown> } | null;
    return E.right(design?.look ?? null);
  }

  /** Guarda `design.look` sin pisar otras claves de `design`. La app en prod no
   *  lee esta columna, así que guardar acá no cambia nada en los catálogos
   *  publicados hasta que se despliegue el render. */
  async saveLook(tenantId: number, look: object): Promise<E.Either<Error, true>> {
    const { data, error: readError } = await this.client
      .from('tenant_ecommerce_config')
      .select('design')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (readError) return E.left(new Error(readError.message));
    const design = { ...((data?.design as object | null) ?? {}), look };
    const { error } = await this.client
      .from('tenant_ecommerce_config')
      .update({ design })
      .eq('tenant_id', tenantId);
    if (error) return E.left(new Error(error.message));
    return E.right(true);
  }

  async listVisible(
    tenantId: number,
    limit = 60
  ): Promise<E.Either<Error, DesignProductOption[]>> {
    const { data, error } = await this.client
      .from('products')
      .select('id, name, price, photos')
      .eq('tenant_id', tenantId)
      .eq('is_hidden', false)
      .order('position', { ascending: true })
      .limit(limit);
    if (error) return E.left(new Error(error.message));
    return E.right(
      (data ?? []).map((p: { id: string | number; name: string; price: number; photos: string[] | null }) => ({
        id: String(p.id),
        name: p.name,
        price: Number(p.price ?? 0),
        photo: p.photos?.[0] ?? null,
      }))
    );
  }

  /** Sube la imagen o el video de fondo del catálogo a S3 (CDN). La imagen se
   *  comprime a WebP; el video va tal cual (máx 15 MB). */
  async uploadBackground(file: File, kind: 'image' | 'video'): Promise<E.Either<Error, string>> {
    try {
      if (kind === 'video') {
        if (!/^video\/(mp4|webm)$/.test(file.type)) return E.left(new Error('Usa un video MP4 o WebM.'));
        if (file.size > 15 * 1024 * 1024) return E.left(new Error('El video pesa más de 15 MB.'));
        return E.right(await signedUpload(file, file.name, file.type, 'banner'));
      }
      const body = await compressImage(file, { maxWidth: 1920, quality: 0.8 });
      return E.right(await signedUpload(body, file.name, preferredImageFormat().mime, 'banner'));
    } catch (error) {
      return E.left(error as Error);
    }
  }
}
