import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { Either } from '@sweet-monads/either';

export interface EditorUsageStore {
  tenant_id: number;
  name: string;
  slug: string;
  plan: string;
  is_free: boolean;
  theme: string | null;
  font: string | null;
  bg_type: string | null;
  button_style: string | null;
  saved_at: string | null;
}

export interface EditorUsageData {
  total_stores: number;
  paid_stores: number;
  using: number;
  using_paid: number;
  with_theme: number;
  last_7_days: number;
  options: { option: string; value: string; stores: number }[];
  daily: { day: string; stores: number }[];
  stores: EditorUsageStore[];
}

/** Métricas de adopción del editor de diseño (RPC catalog_editor_usage_admin). */
@Injectable({ providedIn: 'root' })
export class EditorUsageService {
  private readonly client = SupabaseClientProvider.getInstance();

  async get(): Promise<Either<Error, EditorUsageData>> {
    const { data, error } = await this.client.rpc('catalog_editor_usage_admin');
    if (error) return E.left(new Error(error.message));
    return E.right(data as EditorUsageData);
  }
}
