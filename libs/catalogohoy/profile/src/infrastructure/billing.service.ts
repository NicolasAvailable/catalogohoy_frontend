import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { environment } from '@catalogohoy/env';
import { E } from '@shared/domain';

export type BillingEntryStatus =
  | 'paid'
  | 'pending'
  | 'failed'
  | 'refunded'
  | 'open'
  | 'void';

export interface BillingEntry {
  id: string;
  date: string;
  source: 'stripe' | 'manual';
  method: string;
  methodLabel: string;
  amountUsd: number;
  description: string;
  status: BillingEntryStatus;
  receiptUrl?: string;
  invoicePdfUrl?: string;
  reference?: string;
  notes?: string;
  /** Manual entries only. Frontend uses this to call render-invoice. */
  invoiceNumber?: string;
}

@Injectable({ providedIn: 'root' })
export class BillingService {
  private readonly client = SupabaseClientProvider.getInstance();

  /** Returns the unified payment history for a tenant — Stripe invoices +
   *  manual entries (Pago Móvil, transferencia, etc.) merged and sorted by
   *  date desc. The edge function enforces that only the tenant OWNER can
   *  read this; team members get 403. */
  public async getPaymentHistory(
    tenantId: number | string
  ): Promise<E.Either<Error, BillingEntry[]>> {
    const { data, error } = await this.client.functions.invoke<{
      entries: BillingEntry[];
    }>('get-billing-history', {
      body: { tenantId: Number(tenantId) },
    });

    if (error) return E.left(new Error(error.message ?? 'No se pudo cargar el historial'));
    return E.right(data?.entries ?? []);
  }

  /** Crea una sesión del Stripe Billing Portal (actualizar tarjeta + ver
   *  facturas) y devuelve su URL. Solo funciona para el OWNER de un tenant
   *  con `stripe_customer_id`; la edge function valida ambas cosas. */
  public async createBillingPortalSession(
    tenantId: number | string,
    locale: string
  ): Promise<E.Either<Error, string>> {
    const { data, error } = await this.client.functions.invoke<{ url: string }>(
      'create-billing-portal-session',
      { body: { tenantId: Number(tenantId), locale } }
    );

    if (error) return E.left(new Error(error.message ?? 'No se pudo abrir el portal de pago'));
    if (!data?.url) return E.left(new Error('No se pudo abrir el portal de pago'));
    return E.right(data.url);
  }

  /** Trigger a PDF download for the given manual invoice. */
  public async downloadInvoicePdf(invoiceNumber: string): Promise<E.Either<Error, void>> {
    const result = await this.fetchInvoice(invoiceNumber, 'pdf');
    return result.mapRight((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `factura-${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    });
  }

  /** Fetch the render-invoice edge function as a Blob. We can't use
   *  `client.functions.invoke()` here because that helper always parses
   *  the response as JSON — it would corrupt the PDF bytes. */
  private async fetchInvoice(
    invoiceNumber: string,
    format: 'pdf'
  ): Promise<E.Either<Error, Blob>> {
    try {
      const { data: session } = await this.client.auth.getSession();
      const accessToken = session.session?.access_token;
      if (!accessToken) return E.left(new Error('Sesión no válida — iniciá sesión nuevamente.'));

      const url = `${environment.supabaseUrl}/functions/v1/render-invoice?invoice=${encodeURIComponent(invoiceNumber)}&format=${format}`;

      const res = await fetch(url, {
        method: 'GET',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return E.left(new Error(`HTTP ${res.status}: ${text || 'No se pudo cargar la factura'}`));
      }

      return E.right(await res.blob());
    } catch (err) {
      return E.left(err instanceof Error ? err : new Error(String(err)));
    }
  }
}
