import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  BaseProductAiPdfService,
  PdfCatalogPage,
  PdfParsedProduct,
} from '../domain';
import { CreditsStore } from './credits.store';

@Injectable({ providedIn: 'root' })
export class ProductAiPdfService implements BaseProductAiPdfService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly credits = inject(CreditsStore);

  /** Estructura el texto de las páginas del PDF en productos (nombre + precio,
   *  conservando la página). Cobra 1 crédito de IA por página analizada. */
  async parsePages(
    pages: PdfCatalogPage[]
  ): Promise<E.Either<Error, PdfParsedProduct[]>> {
    try {
      const { data, error } = await this.client.functions.invoke(
        'ai-pdf-import',
        { body: { pages } }
      );
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('Failed to send')) {
          return E.left(
            new Error('No se pudo conectar con la IA. Verifica tu conexión.')
          );
        }
        const backend = await this.readInvokeError(error);
        if (backend.code === 'no_credits') {
          this.credits.setBalance(0);
          return E.left(
            new Error('No te quedan créditos de IA. Compra más o sube de plan.')
          );
        }
        return E.left(
          new Error(backend.message || msg || 'La IA no pudo leer el PDF')
        );
      }

      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (!parsed?.success || !Array.isArray(parsed?.products)) {
        if (parsed?.code === 'no_credits') this.credits.setBalance(0);
        return E.left(new Error(parsed?.error ?? 'La IA no pudo leer el PDF'));
      }
      if (typeof parsed.balance === 'number') {
        this.credits.setBalance(parsed.balance);
      }
      return E.right(parsed.products as PdfParsedProduct[]);
    } catch (e) {
      console.error('[AI PDF] unexpected error:', e);
      return E.left(new Error('Error de conexión con la IA.'));
    }
  }

  /** Mismo truco que AiImageService: functions.invoke esconde el body real de
   *  un non-2xx en error.context (Response) — lo leemos para recuperar el
   *  code/mensaje del backend (p. ej. el 402 de créditos agotados). */
  private async readInvokeError(
    error: unknown
  ): Promise<{ code?: string; message?: string }> {
    const ctx = (error as { context?: Response }).context;
    if (!ctx || typeof ctx.clone !== 'function') return {};
    try {
      const body = await ctx.clone().json();
      return { code: body?.code, message: body?.error };
    } catch {
      return {};
    }
  }
}
