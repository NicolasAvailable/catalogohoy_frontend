import { E } from '@shared/domain';

// Contrato para la IA de imágenes de producto (fal.ai vía la Edge Function
// `fal-ai-images`). Cada método devuelve la URL pública estable ya persistida
// en Storage, lista para guardarse en `Product.photos`.
export interface BaseAiImageService {
  // Quita el fondo de una imagen ya existente (BiRefNet).
  removeBackground(imageUrl: string): Promise<E.Either<Error, string>>;

  // Sube un PNG ya generado en el cliente (p. ej. el resultado del borrador
  // manual) a Storage y devuelve su URL pública. Conserva la transparencia.
  uploadPng(blob: Blob): Promise<E.Either<Error, string>>;

  // Genera una imagen nueva a partir de un prompt de texto (FLUX).
  generate(prompt: string): Promise<E.Either<Error, string>>;

  // Mejora/alarga/acorta una descripción de producto (Claude Haiku). Devuelve
  // HTML simple listo para el editor.
  improveText(
    text: string,
    mode: 'improve' | 'expand' | 'shorten'
  ): Promise<E.Either<Error, string>>;
}
