import { Injectable, signal } from '@angular/core';
import type {
  CustomerInfo,
  PurchasesOffering,
  PurchasesPackage,
} from '@revenuecat/purchases-capacitor';
import { isAndroidApp, isIosApp, isNativeApp } from '../../constants/tenant.constant';
import {
  REVENUECAT_ANDROID_PUBLIC_KEY,
  REVENUECAT_IOS_PUBLIC_KEY,
} from '../../constants/revenuecat.constant';
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
 * iOS (App Store) + Android (Google Play): en web se paga por Stripe. En nativo
 * configura con la key pública según plataforma (appl_ / goog_). Por el import
 * dinámico, el SDK NO entra al bundle web. Espejo de `PushService`: vive en core,
 * `providedIn:'root'`, guardado por `isNativeApp()`, init idempotente.
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
    if (!isNativeApp()) return false;
    this.configuring ??= this.doConfigure();
    return this.configuring;
  }

  private async doConfigure(): Promise<boolean> {
    try {
      const appUserID = await this.resolveAppUserId();
      const { Purchases, LOG_LEVEL } = await import(
        '@revenuecat/purchases-capacitor'
      );
      // DEBUG temporal para diagnosticar la paywall vacía en Android (muestra
      // "Could not find products" en logcat). Volver a ERROR tras resolver.
      await Purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
      // appUserID identifica al suscriptor en RevenueCat (= auth UUID de
      // Supabase); el webhook lo resuelve a su tenant. Sin él, RC usa un id
      // anónimo y luego habría que logIn — por eso lo pasamos ya en configure.
      await Purchases.configure({
        apiKey: isAndroidApp()
          ? REVENUECAT_ANDROID_PUBLIC_KEY
          : REVENUECAT_IOS_PUBLIC_KEY,
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
    if (!(await this.init())) {
      this.reportOfferingsDiag('init_failed', null, null, null);
      return null;
    }
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      const offerings = await Purchases.getOfferings();
      // Sonda directa a la tienda: qué productos encuentra BillingClient/StoreKit
      // para los IDs de suscripción. Si esto viene vacío, el problema es que la
      // tienda no devuelve los productos (no el mapeo de la oferta).
      let probeIds: string[] = [];
      try {
        const probe = await Purchases.getProducts({
          productIdentifiers: ['ch_basico', 'ch_pro', 'ch_avanzado'],
        });
        probeIds = (probe.products ?? []).map((p) => p.identifier);
      } catch {
        /* la sonda es best-effort; no bloquea */
      }
      this.reportOfferingsDiag('ok', offerings, probeIds, null);
      return offerings.current ?? null;
    } catch (err) {
      console.error('[revenuecat] getOfferings failed', err);
      this.reportOfferingsDiag('error', null, null, err);
      return null;
    }
  }

  /** Telemetría de diagnóstico de la oferta a Sentry (los problemas de IAP en
   *  Android no dan error visible: la paywall simplemente sale vacía). Reporta
   *  si la oferta vino null / con 0 paquetes, los identifiers de los productos
   *  que SÍ llegaron y lo que la tienda devolvió en la sonda directa. Solo
   *  nativo, best-effort. */
  private reportOfferingsDiag(
    stage: 'init_failed' | 'ok' | 'error',
    offerings: { all?: Record<string, unknown>; current?: PurchasesOffering | null } | null,
    probeIds: string[] | null,
    err: unknown
  ): void {
    if (!isNativeApp()) return;
    try {
      const current = offerings?.current ?? null;
      const pkgs = current?.availablePackages ?? [];
      const diag = {
        stage,
        nativePlatform: isAndroidApp() ? 'android' : 'ios',
        allOfferingIds: offerings?.all ? Object.keys(offerings.all) : [],
        currentId: current?.identifier ?? null,
        availableCount: pkgs.length,
        packageProductIds: pkgs.map((p) => p.product?.identifier),
        storeProbeIds: probeIds,
        error: this.describeError(err),
      };
      void import('@sentry/angular')
        .then((Sentry) => {
          Sentry.captureMessage(
            `revenuecat_offerings [${stage}] avail=${diag.availableCount} probe=${probeIds?.length ?? 'n/a'}`,
            {
              level: diag.availableCount > 0 ? 'info' : 'warning',
              tags: {
                area: 'revenuecat-offerings',
                nativePlatform: diag.nativePlatform,
                stage,
              },
              extra: diag,
            }
          );
        })
        .catch(() => {
          /* best-effort */
        });
    } catch {
      /* nunca romper el flujo por telemetría */
    }
  }

  /** Extrae TODO lo útil del error de RevenueCat, en especial el
   *  `underlyingErrorMessage` (el "check the underlying error" que trae la causa
   *  real: producto no encontrado, billing no disponible, etc.) + el código. */
  private describeError(err: unknown): Record<string, unknown> | null {
    if (!err) return null;
    const e = err as Record<string, unknown>;
    let raw: string;
    try {
      raw = JSON.stringify(err, Object.getOwnPropertyNames(e));
    } catch {
      raw = String(err);
    }
    return {
      message: e['message'] ?? String(err),
      code: e['code'] ?? null,
      readableErrorCode: e['readableErrorCode'] ?? null,
      underlyingErrorMessage: e['underlyingErrorMessage'] ?? null,
      raw,
    };
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
    if (!isNativeApp() || !this.ready()) return;
    try {
      const { Purchases } = await import('@revenuecat/purchases-capacitor');
      await Purchases.logOut();
    } catch (err) {
      console.error('[revenuecat] logOut failed', err);
    }
  }
}
