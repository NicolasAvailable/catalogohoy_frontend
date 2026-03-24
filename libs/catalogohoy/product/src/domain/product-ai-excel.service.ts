import { E } from '@shared/domain';
import { ProductExcelRow } from './product-import-export.type';

export interface BaseProductAiExcelService {
  aiParse(
    headers: string[],
    rows: Record<string, unknown>[]
  ): Promise<E.Either<Error, ProductExcelRow[]>>;
}
