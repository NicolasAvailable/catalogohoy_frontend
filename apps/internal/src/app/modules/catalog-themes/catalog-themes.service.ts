import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';
import { CatalogTheme, DEFAULT_THEME_LOOK, ThemeLook } from './catalog-themes.model';

interface CatalogThemeRow {
  id: string;
  name: string;
  color: string;
  look: Partial<ThemeLook> | null;
  is_premium: boolean;
  is_active: boolean;
  sort_order: number;
  stores_using: number | string;
  updated_at: string | null;
}

@Injectable({ providedIn: 'root' })
export class CatalogThemesService {
  private readonly client = SupabaseClientProvider.getInstance();

  async list(): Promise<Either<Error, CatalogTheme[]>> {
    const { data, error } = await this.client.rpc('list_catalog_themes_admin');
    if (error) return E.left(new Error(error.message));
    return E.right(
      ((data as CatalogThemeRow[]) ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        color: r.color,
        // Los temas viejos no traen todos los campos (p. ej. degradado en un
        // tema plano): se completan con los valores por defecto.
        look: { ...DEFAULT_THEME_LOOK, ...(r.look ?? {}) },
        isPremium: r.is_premium,
        isActive: r.is_active,
        sortOrder: r.sort_order,
        storesUsing: Number(r.stores_using) || 0,
        updatedAt: r.updated_at,
      }))
    );
  }

  async save(theme: CatalogTheme, isNew: boolean): Promise<Either<Error, string>> {
    const { data, error } = await this.client.rpc('save_catalog_theme_admin', {
      p_id: theme.id,
      p_name: theme.name,
      p_color: theme.color,
      p_look: theme.look,
      p_is_premium: theme.isPremium,
      p_is_active: theme.isActive,
      p_is_new: isNew,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(String(data));
  }

  async reorder(ids: string[]): Promise<Either<Error, void>> {
    const { error } = await this.client.rpc('reorder_catalog_themes_admin', { p_ids: ids });
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async remove(id: string): Promise<Either<Error, void>> {
    const { error } = await this.client.rpc('delete_catalog_theme_admin', { p_id: id });
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }
}
