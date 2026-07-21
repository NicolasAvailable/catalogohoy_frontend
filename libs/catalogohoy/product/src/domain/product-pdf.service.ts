import { E } from '@shared/domain';
import {
  PdfCatalogPage,
  PdfCatalogParseResult,
  PdfParsedProduct,
} from './product-pdf-import.type';

/** Parseo local (en el navegador) de un PDF de catálogo: texto por página +
 *  imágenes de producto recortadas del render. No consume créditos de IA. */
export interface BaseProductPdfCatalogService {
  parse(
    file: File,
    onProgress?: (done: number, total: number) => void
  ): Promise<E.Either<Error, PdfCatalogParseResult>>;
}

/** Estructura el texto de las páginas en productos vía la edge function
 *  `ai-pdf-import` (Claude). Cobra créditos de IA por página analizada. */
export interface BaseProductAiPdfService {
  parsePages(
    pages: PdfCatalogPage[]
  ): Promise<E.Either<Error, PdfParsedProduct[]>>;
}
