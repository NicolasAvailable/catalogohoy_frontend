/** Texto de una página del PDF (para estructurar productos con IA). */
export interface PdfCatalogPage {
  page: number;
  text: string;
}

/** Imagen embebida recortada del render de una página del PDF. */
export interface PdfCatalogImage {
  page: number;
  blob: Blob;
  width: number;
  height: number;
}

export interface PdfCatalogParseResult {
  pages: PdfCatalogPage[];
  images: PdfCatalogImage[];
}

/** Producto estructurado por la IA a partir del texto del PDF. La página
 *  se conserva para el matching posterior de fotos (misma página). */
export interface PdfParsedProduct {
  page: number;
  name: string;
  price: number;
}
