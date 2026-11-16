import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';

/** Cliente guardado (`customers`) tal como lo usa el formulario de orden para
 *  rellenar sus datos. Vive en `order` (y no en `client`) porque `client` ya
 *  importa de `order`: así no hay dependencia circular. */
export interface OrderCustomer {
  id: number;
  name: string;
  phone: string;
  nickname: string | null;
  document: string | null;
  address: string | null;
}

/** Quita lo que rompe el filtro `or` de PostgREST (comas, paréntesis) y los
 *  comodines del ilike que el usuario no quiso escribir. */
export function sanitizeCustomerTerm(term: string): string {
  return term.replace(/[,()*%\\]/g, ' ').replace(/\s+/g, ' ').trim();
}

@Injectable({ providedIn: 'root' })
export class OrderCustomerService {
  private readonly client = SupabaseClientProvider.getInstance();

  private static readonly COLUMNS = 'id, name, phone, nickname, document, address';

  /** Busca clientes de la tienda por nombre, apodo, teléfono o cédula/RIF. */
  async search(
    tenantId: number,
    term: string,
    limit = 8
  ): Promise<E.Either<Error, OrderCustomer[]>> {
    const q = sanitizeCustomerTerm(term);
    if (q.length < 2) return E.right([]);
    const like = `%${q}%`;
    // Teléfono: se guarda como +58424…; quien escribe "0424…" pone el 0 local,
    // así que se busca por los dígitos sin ese 0 inicial.
    const digits = q.replace(/\D/g, '').replace(/^0+/, '');
    const filters = [
      `name.ilike.${like}`,
      `nickname.ilike.${like}`,
      `document.ilike.${like}`,
      // El teléfono se guarda con +código: buscamos solo por sus dígitos.
      ...(digits.length >= 3 ? [`phone.ilike.%${digits}%`] : []),
      // Cédula/RIF escrita sin letra ni puntos ("12345678" encuentra
      // "V-12.345.678"): los dígitos en orden, con lo que sea en el medio.
      ...(digits.length >= 5 ? [`document.ilike.%${digits.split('').join('%')}%`] : []),
    ];

    const { data, error } = await this.client
      .from('customers')
      .select(OrderCustomerService.COLUMNS)
      .eq('tenant_id', tenantId)
      .or(filters.join(','))
      .order('updated_at', { ascending: false })
      .limit(limit);

    if (error) return E.left(new Error(error.message));
    return E.right((data ?? []) as OrderCustomer[]);
  }

  /** Cliente guardado con ese teléfono (para completar el apodo al editar). */
  async findByPhone(
    tenantId: number,
    phone: string
  ): Promise<E.Either<Error, OrderCustomer | null>> {
    const p = phone.trim();
    if (!p) return E.right(null);
    const { data, error } = await this.client
      .from('customers')
      .select(OrderCustomerService.COLUMNS)
      .eq('tenant_id', tenantId)
      .eq('phone', p)
      .maybeSingle();
    if (error) return E.left(new Error(error.message));
    return E.right((data as OrderCustomer | null) ?? null);
  }

  /** Guarda el apodo en la ficha del cliente. El nombre, la cédula/RIF y la
   *  dirección los copia el trigger `sync_customer_from_order` al guardar la
   *  orden; el apodo no existe en `orders`, por eso va aparte. */
  async saveNickname(
    tenantId: number,
    phone: string,
    nickname: string
  ): Promise<E.Either<Error, void>> {
    const p = phone.trim();
    const n = nickname.trim();
    if (!p || !n) return E.right(undefined);
    const { error } = await this.client
      .from('customers')
      .update({ nickname: n, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('phone', p);
    return error ? E.left(new Error(error.message)) : E.right(undefined);
  }
}
