import { Injectable, inject, signal } from '@angular/core';
import { EcommerceConfigStore } from '@catalogohoy/ecommerce-config';
import { OrderItem, OrderStatus, OrderStore } from '@catalogohoy/order';
import { RateStore } from '@catalogohoy/rate';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { PosCajaStore } from '../pos-caja.store';

/** Payload de una venta cobrada sin conexión, lista para re-enviarse tal cual
 *  a `OrderStore.createOrder` al volver la red. */
export interface QueuedSale {
  /** uuid de idempotencia (columna orders.pos_client_id, índice único). */
  clientId: string;
  tenantKey: string;
  /** Epoch ms del cobro — orden FIFO del sync. */
  chargedAt: number;
  /** Reintentos de sync fallidos (para no insistir ciegamente). */
  tries: number;
  order: {
    name: string;
    phone?: string;
    comments?: string;
    status: OrderStatus;
    products: OrderItem[];
    totalUsd: number;
    totalBs: number;
    deliveryDate?: string;
    paymentMethod?: string;
    shippingFee?: number;
    source: string;
    posCashSessionId?: number | null;
  };
}

/** Espejo local de los datos que el POS necesita para operar sin red (F1). */
export interface PosSnapshot {
  savedAt: number;
  tenantId: number;
  /** Productos serializados (JSON plano de `Product[]`). */
  products: unknown[];
  /** `EcommerceConfig` serializada (para moneda/país/impuesto). */
  config: unknown | null;
  /** Última `ExchangeRate` conocida (VE). */
  rate: unknown | null;
}

/** ¿El mensaje de error corresponde a una caída de red? Cubre los textos
 *  reales de los 3 motores: Chrome "Failed to fetch", Firefox "NetworkError
 *  when attempting to fetch resource.", Safari/WebKit "Load failed" (el POS
 *  corre mayormente en iPad). supabase-js v2 NO rechaza ante fallo de red:
 *  resuelve con `error.message = "TypeError: <texto>"`. */
export function isNetworkError(message: string): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet/i.test(
    message
  );
}

const DB_NAME = 'pos-offline';
const DB_VERSION = 1;
const STORE_CACHE = 'cache';
const STORE_QUEUE = 'queue';
/** Último tenant que abrió el POS — permite cargar settings/caché si la red
 *  cae antes de poder resolver el tenant. */
const LAST_TENANT_KEY = 'pos:last-tenant';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_CACHE))
        db.createObjectStore(STORE_CACHE);
      if (!db.objectStoreNames.contains(STORE_QUEUE))
        db.createObjectStore(STORE_QUEUE, { keyPath: 'clientId' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  db: IDBDatabase,
  store: string,
  mode: IDBTransactionMode,
  run: (s: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = run(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * CAT-85 · POS offline (F1 + F2).
 *
 * F1 — caché de lectura: snapshot de productos/config/tasa en IndexedDB cada
 * vez que el POS carga con red; si la red falta, los stores se siembran desde
 * ahí (vía `ProductStore.set`, `EcommerceConfigStore.hydrate`, `RateStore.hydrate`).
 *
 * F2 — cola de ventas: una venta cobrada sin red se guarda local con un uuid
 * (idempotencia server-side vía índice único en orders.pos_client_id) y se
 * sincroniza sola al reconectar, en orden FIFO. El stock se descuenta recién
 * al sincronizar (regla documentada: en tienda física el stock está a la vista).
 *
 * Alcance F1+F2: sesión del POS ya abierta (corte de luz/datos a mitad de
 * jornada). Abrir el POS desde cero sin red requiere el service worker (F3).
 */
@Injectable({ providedIn: 'root' })
export class PosOfflineStore {
  private readonly orderStore = inject(OrderStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly rateStore = inject(RateStore);
  private readonly caja = inject(PosCajaStore);
  private readonly toast = inject(ToastService);

  /** Estado de red reactivo (navigator.onLine + eventos online/offline). */
  readonly online = signal(typeof navigator === 'undefined' ? true : navigator.onLine);
  /** Ventas cobradas sin conexión, a la espera de sync. */
  readonly pending = signal(0);
  readonly syncing = signal(false);

  private tenantKey = '';
  private initialized = false;

  /** Idempotente. Registra los listeners de red, cuenta pendientes y dispara
   *  un sync si hay red y cola. */
  async init(tenantId: number | string | null): Promise<void> {
    const key = tenantId != null ? String(tenantId) : this.lastTenantKey();
    if (!key) return;
    this.tenantKey = key;
    if (tenantId != null) {
      try {
        localStorage.setItem(LAST_TENANT_KEY, key);
      } catch {
        /* sin localStorage no hay fallback de tenant; no es crítico */
      }
    }
    if (!this.initialized) {
      this.initialized = true;
      window.addEventListener('online', () => {
        this.online.set(true);
        void this.onReconnect();
      });
      window.addEventListener('offline', () => this.online.set(false));
    }
    await this.refreshPending();
    if (this.online() && this.pending() > 0) void this.sync();
  }

  /** Al volver la red: sube la cola Y refresca config/tasa — la hidratación
   *  offline sembró datos del caché y `loadConfig` tiene guard "si ya hay
   *  config, no-op", así que sin este reload la config vieja quedaría pegada
   *  toda la sesión (incluso navegando al admin). */
  private async onReconnect(): Promise<void> {
    await this.sync();
    if (this.tenantKey) {
      void this.configStore.reloadConfig(this.tenantKey);
      void this.rateStore.loadRates();
    }
  }

  /** Tenant con el que se abrió el POS por última vez (fallback offline). */
  lastTenantKey(): string {
    try {
      return localStorage.getItem(LAST_TENANT_KEY) ?? '';
    } catch {
      return '';
    }
  }

  // ── F1 · caché de lectura ──────────────────────────────────────────────────

  async saveSnapshot(snap: PosSnapshot): Promise<void> {
    try {
      const db = await this.database();
      await tx(db, STORE_CACHE, 'readwrite', (s) =>
        s.put(snap, `snapshot:${snap.tenantId}`)
      );
    } catch {
      /* caché best-effort: sin IndexedDB el POS sigue funcionando online */
    }
  }

  async loadSnapshot(): Promise<PosSnapshot | null> {
    if (!this.tenantKey) return null;
    try {
      const db = await this.database();
      const snap = await tx<PosSnapshot | undefined>(
        db,
        STORE_CACHE,
        'readonly',
        (s) => s.get(`snapshot:${this.tenantKey}`) as IDBRequest<PosSnapshot | undefined>
      );
      return snap ?? null;
    } catch {
      return null;
    }
  }

  // ── F2 · cola de ventas offline ────────────────────────────────────────────

  async enqueue(order: QueuedSale['order']): Promise<QueuedSale> {
    const sale: QueuedSale = {
      clientId: crypto.randomUUID(),
      tenantKey: this.tenantKey,
      chargedAt: Date.now(),
      tries: 0,
      order,
    };
    const db = await this.database();
    await tx(db, STORE_QUEUE, 'readwrite', (s) => s.put(sale));
    await this.refreshPending();
    return sale;
  }

  /** Tras N fallos NO-red, una venta deja de reintentarse en los sync
   *  automáticos (solo el sync manual del chip la vuelve a intentar) — evita
   *  que un error permanente (p.ej. tope de plan) martille y spamee toasts. */
  private static readonly MAX_AUTO_TRIES = 5;

  /** Sube las ventas pendientes en orden FIFO. Corta ante un error de red
   *  (reintenta en el próximo 'online'); un duplicado (sync anterior cortado
   *  a la mitad) se da por sincronizado. `manual=true` (chip) reintenta
   *  también las ventas que agotaron sus reintentos automáticos. */
  async sync(manual = false): Promise<void> {
    if (this.syncing() || !this.online() || !this.tenantKey) return;
    // El flag ANTES de cualquier await: 'online' + init del shell + init de
    // venta + click manual pueden solaparse y colarse todos por el guard.
    this.syncing.set(true);
    let synced = 0;
    let failed = 0;
    try {
      const sales = (await this.queued())
        .filter((s) => manual || s.tries < PosOfflineStore.MAX_AUTO_TRIES)
        .sort((a, b) => a.chargedAt - b.chargedAt);
      for (const sale of sales) {
        const result = await this.orderStore.createOrder({
          ...sale.order,
          // Si la caja a la que se imputó ya no es la sesión abierta (se cerró
          // con el arqueo congelado antes de este sync), la venta entra sin
          // caja: imputarla a una sesión cerrada descuadraría su cierre.
          posCashSessionId:
            sale.order.posCashSessionId != null &&
            sale.order.posCashSessionId === this.caja.openSessionId()
              ? sale.order.posCashSessionId
              : null,
          posClientId: sale.clientId,
        });
        const ok = result.fold(
          (error: string) => {
            // Índice único (tenant_id, pos_client_id): la orden ya existe de
            // un sync anterior que se cortó después del insert.
            if (/duplicate key|pos_client_unique|23505/i.test(error)) return true;
            // Sin red a mitad del sync: cortar y reintentar al reconectar.
            if (isNetworkError(error)) return null;
            return false;
          },
          () => true
        );
        if (ok === null) break;
        if (ok) {
          await this.dequeue(sale.clientId);
          synced++;
        } else {
          failed++;
          await this.bumpTries(sale);
        }
      }
    } finally {
      this.syncing.set(false);
      await this.refreshPending();
    }
    if (synced > 0) {
      this.toast.success(
        synced === 1
          ? '1 venta offline sincronizada ✓'
          : `${synced} ventas offline sincronizadas ✓`
      );
      // Ventas imputadas a la caja abierta: refrescar su arqueo.
      if (this.caja.hasOpenSession()) this.caja.refresh();
    }
    if (failed > 0) {
      this.toast.error(
        'Algunas ventas offline no se pudieron sincronizar. Revisa el detalle en Movimientos.' as unknown as Exception
      );
    }
  }

  private async queued(): Promise<QueuedSale[]> {
    try {
      const db = await this.database();
      const all = await tx<QueuedSale[]>(db, STORE_QUEUE, 'readonly', (s) =>
        s.getAll() as IDBRequest<QueuedSale[]>
      );
      return all.filter((q) => q.tenantKey === this.tenantKey);
    } catch {
      return [];
    }
  }

  private async dequeue(clientId: string): Promise<void> {
    const db = await this.database();
    await tx(db, STORE_QUEUE, 'readwrite', (s) => s.delete(clientId));
  }

  private async bumpTries(sale: QueuedSale): Promise<void> {
    const db = await this.database();
    await tx(db, STORE_QUEUE, 'readwrite', (s) =>
      s.put({ ...sale, tries: sale.tries + 1 })
    );
  }

  private async refreshPending(): Promise<void> {
    this.pending.set((await this.queued()).length);
  }

  /** Memoiza la PROMESA (no la conexión): dos llamadas concurrentes en el
   *  arranque (refreshPending + saveSnapshot) comparten el mismo open. */
  private dbPromise: Promise<IDBDatabase> | null = null;
  private database(): Promise<IDBDatabase> {
    if (!this.dbPromise) this.dbPromise = openDb();
    return this.dbPromise;
  }
}
