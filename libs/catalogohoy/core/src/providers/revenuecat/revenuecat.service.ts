import { Injectable, signal } from '@angular/core';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from '@revenuecat/purchases-capacitor';
import { isIosApp } from '../../constants/tenant.constant';
import { REVENUECAT_IOS_PUBLIC_KEY } from '../../constants/revenuecat.constant';
import { SupabaseClientProvider } from '../supabase/supabase';

/** Resultado de un intento de compra. `cancelled` = el usuario cerró la hoja de
 *  pago de Apple (no es un error que mostrar). */
export interface PurchaseOutcome {
  ok: boolean;
  cancelled: boolean;
  error?: string;
  customerInfo?: CustomerInfo;
}

/**
 * Compras in-app (IAP) de planes vía RevenueCat (`@revenuecat/purchases-capacitor`).
 * SOLO iOS por ahora (App Store): en web se paga por Stripe y en Android todavía
 * no hay billing, así que acá es no-op y, por el import dinámico, el SDK NO entra
 * al bundle web. Espejo de `PushService`: vive en core, `providedIn:'root'`,
 * guardado por `isIosApp()`, init idempotente.
 *
 * El estado del plan NO se decide acá: RevenueCat manda un webhook a la edge
 * function `revenuecat-webhook`, que escribe `tenants.plan_id` (igual que el
 * stripe-webhook). Tras una compra, la app solo refresca el PlanStore.
 */
@Injectable({ providedIn: 'root' })
export class RevenueCatService {
  private configuring: Promise<boolean> | null = null;
  /** true cuando el SDK quedó configurado y se puede comprar/leer ofertas. */
  public readonly ready = signal(false);

  /** Configura el SDK con el usuario logueado (auth UUID como appUserID).
   *  Idempotente; no-op fuera de iOS. Se llama desde el layout del admin
   *  (post-login). Devuelve si quedó listo. */
  async init(): Promise<boolean> {
    if (!isIosApp()) return false;
    this.configuring ??= this.doConfigure();
    return this.configuring;
  }

  private async doConfigure(): Promise<boolean> {
    try {
      const appUserID = await this.resolveAppUserId();
      const { Purchases, LOG_LEVEL } = await import(
        '@revenuecat/purchases-capacitor'
      );
      await Purchases.setLogLevel({ level: LOG_LEVEL.ERROR });
      // appUserID identifica al suscriptor en RevenueCat (= auth UUID de
      // Supabase); el webhook lo resuelve a su tenant. Sin él, RC usa un id
      // anónimo y luego habría que logIn — por eso lo pasamos ya en configure.
      await Purchases.configure({
        apiKey: REVENUECAT_IOS_PUBLIC_KEY,
        appUserID,
      });
      this.ready.set(true);
      return true;
    } catch (err) {
      console.error('[revenuecat] configure failed', err);
      this.configuring = null; // permite reintentar en la próxima entrada
      return false;
    }
  }

  private async resolveAppUserId(): Promise<string | undefined> {
    try {
      const {
        data: { user },
      } = await SupabaseClientProvider.getInstance().auth.getUser();
      return user?.id;
    } catch {
      return undefined;
    }
  }

  /** Oferta vigente (`offering.current`) con sus packages (basico/pro/avanzado ×
   *  mensual/anual). Devuelve null si no hay oferta o el SDK no está listo. */
  async getCurrentOffering(): Promise<PurchasesOffering | null> {
    if (!(await this.init())) return null;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { current } = await Purchases.getOfferings();
      return current ?? null;
    } catch (err) {
      console.error('[revenuecat] getOfferings failed', err);
      return null;
    }
  }

  /** Compra un package. Distingue la cancelación del usuario de un error real. */
  async purchase(pkg: PurchasesPackage): Promise<PurchaseOutcome> {
    if (!(await this.init())) {
      return { ok: false, cancelled: false, error: 'not_ready' };
    }
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.purchasePackage({
        aPackage: pkg,
      });
      return { ok: true, cancelled: false, customerInfo };
    } catch (err: unknown) {
      const e = err as { userCancelled?: boolean; message?: string };
      if (e?.userCancelled) return { ok: false, cancelled: true };
      console.error('[revenuecat] purchase failed', err);
      return { ok: false, cancelled: false, error: e?.message ?? 'purchase_failed' };
    }
  }

  /** Restaura compras previas (requisito de Apple). Devuelve el CustomerInfo. */
  async restore(): Promise<CustomerInfo | null> {
    if (!(await this.init())) return null;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.restorePurchases();
      return customerInfo;
    } catch (err) {
      console.error('[revenuecat] restore failed', err);
      return null;
    }
  }

  /** Identificadores de los entitlements activos (basico/pro/avanzado). */
  async activeEntitlements(): Promise<string[]> {
    if (!(await this.init())) return [];
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const { customerInfo } = await Purchases.getCustomerInfo();
      return Object.keys(customerInfo.entitlements.active);
    } catch {
      return [];
    }
  }

  /** Desvincula al usuario del SDK al cerrar sesión (evita mezclar compras entre
   *  cuentas en el mismo dispositivo). No-op fuera de iOS. */
  async logOut(): Promise<void> {
    if (!isIosApp() || !this.ready()) return;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      await Purchases.logOut();
    } catch (err) {
      console.error('[revenuecat] logOut failed', err);
    }
  }
}
