import { Injectable, signal } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';

export type CreditPackId = '150' | '500';

// ── Pricing de créditos (DEBE coincidir con la edge function create-credit-
// checkout, que es la autoritativa). Acá solo se usa para mostrar el precio en
// vivo mientras el usuario arma su paquete. ───────────────────────────────────
export const CREDITS_BASE_CENTS = 1.9; // $0.019 / crédito
export const CREDITS_MIN = 100;
export const CREDITS_MAX = 5000;
export const CREDITS_STEP = 50;

export function creditsVolumeDiscount(credits: number): number {
  if (credits >= 2000) return 0.1;
  if (credits >= 1000) return 0.08;
  if (credits >= 600) return 0.06;
  if (credits >= 300) return 0.05;
  return 0;
}

export interface CreditQuote {
  credits: number;
  cents: number; // total en centavos
  discount: number; // 0..1
}

/** Cotización para mostrar (precio total + descuento) de una cantidad. */
export function creditQuote(credits: number): CreditQuote {
  const discount = creditsVolumeDiscount(credits);
  const cents = Math.round(credits * CREDITS_BASE_CENTS * (1 - discount));
  return { credits, cents, discount };
}

/**
 * Estado + API de los créditos de IA del owner. El saldo se mantiene fresco:
 * se carga con `load()` y se actualiza tras cada operación de IA (la edge
 * function devuelve el saldo nuevo) y tras confirmar una compra de pack.
 */
@Injectable({ providedIn: 'root' })
export class CreditsStore {
  private readonly client = SupabaseClientProvider.getInstance();

  public readonly balance = signal<number | null>(null);
  /** Asignación mensual del plan (para mostrar "X / Y" en Mi Perfil). */
  public readonly allowance = signal<number | null>(null);
  /** Próximo reset mensual de los créditos del plan. */
  public readonly resetAt = signal<string | null>(null);
  public readonly loading = signal<boolean>(false);

  /** Carga el saldo del owner (la edge function crea el pozo si no existe). */
  async load(): Promise<void> {
    this.loading.set(true);
    try {
      const { data, error } = await this.client.functions.invoke('get-credits', {
        body: {},
      });
      if (error) return;
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (parsed?.success && typeof parsed.credits === 'number') {
        this.balance.set(parsed.credits);
        if (typeof parsed.allowance === 'number') this.allowance.set(parsed.allowance);
        if (typeof parsed.resetAt === 'string') this.resetAt.set(parsed.resetAt);
      }
    } finally {
      this.loading.set(false);
    }
  }

  /** Actualiza el saldo conocido (lo llaman las operaciones de IA al terminar). */
  setBalance(n: number): void {
    if (typeof n === 'number' && n >= 0) this.balance.set(n);
  }

  /** Inicia el checkout para `credits` créditos (cantidad libre); el precio y el
   *  descuento se calculan en el servidor. Devuelve la URL de Stripe. */
  async buyCredits(
    credits: number,
    returnUrl: string
  ): Promise<E.Either<Error, string>> {
    try {
      const { data, error } = await this.client.functions.invoke(
        'create-credit-checkout',
        { body: { credits, returnUrl } }
      );
      if (error) {
        return E.left(new Error(error.message ?? 'No se pudo iniciar el pago'));
      }
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (!parsed?.success || !parsed?.url) {
        return E.left(new Error(parsed?.error ?? 'No se pudo iniciar el pago'));
      }
      return E.right(parsed.url as string);
    } catch {
      return E.left(new Error('Error de conexión al iniciar el pago.'));
    }
  }

  /** Confirma una compra tras el redirect de Stripe; refresca el saldo.
   *  Devuelve cuántos créditos se agregaron (0 si ya estaba acreditada). */
  async confirmPurchase(sessionId: string): Promise<E.Either<Error, number>> {
    try {
      const { data, error } = await this.client.functions.invoke(
        'confirm-credit-purchase',
        { body: { sessionId } }
      );
      if (error) {
        return E.left(new Error(error.message ?? 'No se pudo confirmar la compra'));
      }
      const parsed = typeof data === 'string' ? JSON.parse(data) : data;
      if (!parsed?.success) {
        return E.left(new Error(parsed?.error ?? 'No se pudo confirmar la compra'));
      }
      if (typeof parsed.credits === 'number') this.balance.set(parsed.credits);
      return E.right(typeof parsed.added === 'number' ? parsed.added : 0);
    } catch {
      return E.left(new Error('Error de conexión al confirmar la compra.'));
    }
  }
}
