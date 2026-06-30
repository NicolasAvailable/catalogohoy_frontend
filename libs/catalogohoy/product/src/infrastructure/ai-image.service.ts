import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { BaseAiImageService } from '../domain';
import { CreditsStore } from './credits.store';

const STORAGE_BUCKET = 'catalogohoy';

@Injectable({ providedIn: 'root' })
export class AiImageService implements BaseAiImageService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly credits = inject(CreditsStore);

  removeBackground(imageUrl: string): Promise<E.Either<Error, string>> {
    return this.invoke({ action: 'remove-background', imageUrl });
  }

  generate(
    prompt: string,
    opts?: { aspectRatio?: string; style?: string }
  ): Promise<E.Either<Error, string>> {
    return this.invoke({
      action: 'generate',
      prompt,
      aspectRatio: opts?.aspectRatio ?? 'auto',
      style: opts?.style ?? 'default',
    });
  }

  async improveText(
    text: string,
    mode: 'improve' | 'expand' | 'shorten'
  ): Promise<E.Either<Error, string>> {
    try {
      const { data, error } = await this.client.functions.invoke(
        'improve-text',
        { body: { text, mode } }
      );
      if (error) {
        const msg = error.message ?? '';
        if (msg.includes('Failed to send')) {
          return E.left(
            new Error('No se pudo conectar con la IA. Verifica tu conexión.')
          );
        }
        return E.left(new Error(msg || 'Error al conectar con la IA de texto'));
      }
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (!parsed?.success || !parsed?.text) {
        if (parsed?.code === 'no_credits') this.credits.setBalance(0);
        return E.left(
          new Error(parsed?.error ?? 'No se pudo mejorar el texto')
        );
      }
      if (typeof parsed.credits === 'number') {
        this.credits.setBalance(parsed.credits);
      }
      return E.right(parsed.text as string);
    } catch (e) {
      console.error('[AI Text] unexpected error:', e);
      return E.left(new Error('Error de conexión con la IA de texto.'));
    }
  }

  async uploadPng(blob: Blob): Promise<E.Either<Error, string>> {
    try {
      const rand = Math.random().toString(36).slice(2, 10);
      const path = `ai/erase_${Date.now()}_${rand}.png`;
      const { error } = await this.client.storage
        .from(STORAGE_BUCKET)
        .upload(path, blob, { contentType: 'image/png' });
      if (error) return E.left(new Error(error.message));
      const { data } = this.client.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);
      return E.right(data.publicUrl);
    } catch (e) {
      console.error('[AI Image] uploadPng error:', e);
      return E.left(new Error('No se pudo subir la imagen recortada.'));
    }
  }

  private async invoke(
    body: Record<string, unknown>
  ): Promise<E.Either<Error, string>> {
    try {
      const { data, error } = await this.client.functions.invoke(
        'fal-ai-images',
        { body }
      );

      if (error) {
        const msg = error.message ?? '';
        console.error('[AI Image] invoke error:', msg);
        if (msg.includes('Failed to send')) {
          return E.left(
            new Error(
              'No se pudo conectar con el servicio de IA. Verifica tu conexion e intenta de nuevo.'
            )
          );
        }
        return E.left(new Error(msg || 'Error al conectar con el servicio de IA'));
      }

      // supabase.functions.invoke puede devolver data como string u objeto.
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;

      if (!parsed?.success || !parsed?.url) {
        // Sin créditos → el saldo es 0; refrescamos para que la UI lo refleje.
        if (parsed?.code === 'no_credits') this.credits.setBalance(0);
        console.error('[AI Image] response not success:', parsed);
        return E.left(
          new Error(parsed?.error ?? 'Error desconocido del servicio de IA')
        );
      }

      // La edge function devuelve el saldo restante tras descontar.
      if (typeof parsed.credits === 'number') {
        this.credits.setBalance(parsed.credits);
      }
      return E.right(parsed.url as string);
    } catch (e) {
      console.error('[AI Image] unexpected error:', e);
      return E.left(
        new Error('Error de conexion con el servicio de IA. Intenta de nuevo.')
      );
    }
  }
}
