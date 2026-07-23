import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';

/** A WhatsApp message template (HSM) as returned by the Graph API. */
export interface WhatsAppTemplate {
  id?: string;
  name: string;
  status: string; // APPROVED | PENDING | REJECTED | ...
  category: string; // MARKETING | UTILITY | AUTHENTICATION
  language: string;
  components?: { type: string; text?: string }[];
}

export interface CreateTemplateInput {
  name: string;
  category: string;
  language: string;
  body: string;
  /** Un ejemplo por variable {{n}} del body, en orden ({{1}} primero). Meta
   *  los exige para aprobar plantillas con variables. */
  examples?: string[];
  /** Encabezado de texto (opcional, sin variables). */
  header?: string;
  /** Pie de página (opcional, texto plano). */
  footer?: string;
}

@Injectable({ providedIn: 'root' })
export class TemplatesService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  async list(): Promise<E.Either<Error, WhatsAppTemplate[]>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return E.left(new Error('Sin tenant activo'));
    const { data, error } = await this.client.functions.invoke('wa-templates', {
      body: { tenantId, action: 'list' },
    });
    if (!error && data?.success) {
      return E.right((data.templates ?? []) as WhatsAppTemplate[]);
    }
    return E.left(new Error(await this.parseError(error, data)));
  }

  async create(input: CreateTemplateInput): Promise<E.Either<Error, void>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return E.left(new Error('Sin tenant activo'));
    const { data, error } = await this.client.functions.invoke('wa-templates', {
      body: { tenantId, action: 'create', template: input },
    });
    if (!error && data?.success) return E.right(undefined);
    return E.left(new Error(await this.parseError(error, data)));
  }

  /** Elimina la plantilla por nombre (Meta la borra en todos sus idiomas). */
  async delete(name: string): Promise<E.Either<Error, void>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return E.left(new Error('Sin tenant activo'));
    const { data, error } = await this.client.functions.invoke('wa-templates', {
      body: { tenantId, action: 'delete', name },
    });
    if (!error && data?.success) return E.right(undefined);
    return E.left(new Error(await this.parseError(error, data)));
  }

  /** Extract a readable message from the function/Graph error shape. */
  private async parseError(error: unknown, data: unknown): Promise<string> {
    const fromBody = (body: { error?: unknown } | null | undefined): string | null => {
      const e = body?.error;
      if (!e) return null;
      if (typeof e === 'string') return e;
      const msg = (e as { message?: string })?.message;
      return msg ?? JSON.stringify(e);
    };

    const direct = fromBody(data as { error?: unknown });
    if (direct) return direct;

    const ctx = (error as { context?: Response } | null)?.context;
    if (ctx) {
      try {
        const parsed = fromBody(await ctx.clone().json());
        if (parsed) return parsed;
      } catch {
        /* sin cuerpo legible */
      }
    }
    return 'No se pudo procesar la plantilla';
  }
}
