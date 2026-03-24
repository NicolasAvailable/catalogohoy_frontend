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
    const { data, error } = await this.client.functions.invoke('ai-excel-mapper', {
      body: { headers, rows },
    });

    if (error) {
      return E.left(new Error(error.message ?? 'Error al conectar con el servicio de IA'));
    }

    if (!data?.success) {
      return E.left(new Error(data?.error ?? 'Error desconocido del servicio de IA'));
    }

    return E.right(data.mappedRows as ProductExcelRow[]);
  }
}
