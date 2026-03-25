import { Injectable } from '@angular/core';
import { E } from '@shared/domain';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { BaseProductAiExcelService, ProductExcelRow } from '../domain';

@Injectable({ providedIn: 'root' })
export class ProductAiExcelService implements BaseProductAiExcelService {
  private readonly client = SupabaseClientProvider.getInstance();

  async aiParse(
    headers: string[],
    rows: Record<string, unknown>[]
  ): Promise<E.Either<Error, ProductExcelRow[]>> {
    try {
      const { data, error } = await this.client.functions.invoke('ai-excel-mapper', {
        body: { headers, rows },
      });

      if (error) {
        const msg = error.message ?? '';
        console.error('[AI Excel] invoke error:', msg);
        if (msg.includes('Failed to send')) {
          return E.left(new Error('No se pudo conectar con el servicio de IA. Verifica tu conexion e intenta de nuevo.'));
        }
        return E.left(new Error(msg || 'Error al conectar con el servicio de IA'));
      }

      // supabase.functions.invoke may return data as a string or object
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;

      if (!parsed?.success) {
        console.error('[AI Excel] response not success:', parsed);
        return E.left(new Error(parsed?.error ?? 'Error desconocido del servicio de IA'));
      }

      if (!Array.isArray(parsed.mappedRows) || parsed.mappedRows.length === 0) {
        return E.left(new Error('La IA no devolvio productos mapeados.'));
      }

      return E.right(parsed.mappedRows as ProductExcelRow[]);
    } catch (e) {
      console.error('[AI Excel] unexpected error:', e);
      return E.left(new Error('Error de conexion con el servicio de IA. Intenta de nuevo.'));
    }
  }
}
