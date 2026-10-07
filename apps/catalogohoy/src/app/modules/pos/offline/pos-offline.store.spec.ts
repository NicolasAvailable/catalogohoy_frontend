import { randomUUID } from 'node:crypto';
import { TestBed } from '@angular/core/testing';
import { EcommerceConfigStore } from '@catalogohoy/ecommerce-config';
import { OrderStore } from '@catalogohoy/order';
import { RateStore } from '@catalogohoy/rate';
import { ToastService } from '@shared/infrastructure';
import * as E from '@sweet-monads/either';
import { PosCajaStore } from '../pos-caja.store';
import {
  isNetworkError,
  PosOfflineStore,
  QueuedSale,
} from './pos-offline.store';

// ── IndexedDB fake mínimo (jsdom no trae IDB): cubre exactamente lo que usa
//    el store — open/upgrade, put/get/getAll/delete con onsuccess async. ──────
type Rows = Map<string, unknown>;

function asyncRequest<T>(value: () => T) {
  const req: {
    onsuccess: (() => void) | null;
    onerror: (() => void) | null;
    result?: T;
    error?: unknown;
  } = { onsuccess: null, onerror: null };
  setTimeout(() => {
    try {
      req.result = value();
      req.onsuccess?.();
    } catch (e) {
      req.error = e;
      req.onerror?.();
    }
  }, 0);
  return req;
}

function installFakeIndexedDb(): void {
  const stores = new Map<string, Rows>();
  const db = {
    objectStoreNames: {
      contains: (n: string) => stores.has(n),
    },
    createObjectStore(n: string, opts?: { keyPath?: string }) {
      stores.set(n, new Map());
      keyPaths.set(n, opts?.keyPath);
      return {};
    },
    transaction(name: string) {
      const rows = stores.get(name)!;
      const keyPath = keyPaths.get(name);
      return {
        objectStore: () => ({
          put: (value: unknown, key?: string) =>
            asyncRequest(() => {
              const k =
                key ?? String((value as Record<string, unknown>)[keyPath!]);
              rows.set(k, value);
              return k;
            }),
          get: (key: string) => asyncRequest(() => rows.get(key)),
          getAll: () => asyncRequest(() => [...rows.values()]),
          delete: (key: string) => asyncRequest(() => void rows.delete(key)),
        }),
      };
    },
  };
  const keyPaths = new Map<string, string | undefined>();
  (globalThis as Record<string, unknown>)['indexedDB'] = {
    open: (_name: string, _v: number) => {
      const req: Record<string, unknown> = {};
      setTimeout(() => {
        (req['onupgradeneeded'] as (() => void) | undefined)?.();
        req['result'] = db;
        (req['onsuccess'] as (() => void) | undefined)?.();
      }, 0);
      Object.defineProperty(req, 'result', { value: db, writable: true });
      return req;
    },
  };
}

const ORDER: QueuedSale['order'] = {
  name: 'Venta en tienda',
  status: 'completed' as QueuedSale['order']['status'],
  products: [],
  totalUsd: 18,
  totalBs: 0,
  source: 'pos',
};

describe('PosOfflineStore (CAT-85 · cola de ventas offline)', () => {
  let store: PosOfflineStore;
  let createOrder: jest.Mock;
  let toastSuccess: jest.Mock;
  let toastError: jest.Mock;

  beforeEach(async () => {
    installFakeIndexedDb();
    // jsdom no implementa crypto.randomUUID (sí existe en navegador y Node).
    if (typeof globalThis.crypto.randomUUID !== 'function') {
      Object.defineProperty(globalThis.crypto, 'randomUUID', {
        value: randomUUID,
        configurable: true,
      });
    }
    localStorage.clear();
    createOrder = jest.fn();
    toastSuccess = jest.fn();
    toastError = jest.fn();
    TestBed.configureTestingModule({
      providers: [
        { provide: OrderStore, useValue: { createOrder } },
        {
          provide: ToastService,
          useValue: { success: toastSuccess, error: toastError },
        },
        {
          provide: EcommerceConfigStore,
          useValue: { reloadConfig: jest.fn() },
        },
        { provide: RateStore, useValue: { loadRates: jest.fn() } },
        {
          provide: PosCajaStore,
          useValue: {
            openSessionId: () => null,
            hasOpenSession: () => false,
            refresh: jest.fn(),
          },
        },
      ],
    });
    store = TestBed.inject(PosOfflineStore);
    await store.init(6);
  });

  it('encola una venta y la cuenta como pendiente', async () => {
    const sale = await store.enqueue(ORDER);
    expect(sale.clientId).toMatch(/[0-9a-f-]{36}/);
    expect(store.pending()).toBe(1);
  });

  it('sincroniza FIFO con el uuid idempotente y vacía la cola', async () => {
    createOrder.mockResolvedValue(E.right({}));
    const a = await store.enqueue({ ...ORDER, totalUsd: 1 });
    const b = await store.enqueue({ ...ORDER, totalUsd: 2 });
    await store.sync();
    expect(createOrder).toHaveBeenCalledTimes(2);
    expect(createOrder.mock.calls[0][0]).toMatchObject({
      totalUsd: 1,
      posClientId: a.clientId,
    });
    expect(createOrder.mock.calls[1][0]).toMatchObject({
      totalUsd: 2,
      posClientId: b.clientId,
    });
    expect(store.pending()).toBe(0);
    expect(toastSuccess).toHaveBeenCalled();
  });

  it('trata el duplicado (sync anterior cortado) como ya sincronizada', async () => {
    createOrder.mockResolvedValue(
      E.left(
        'duplicate key value violates unique constraint "orders_pos_client_unique"'
      )
    );
    await store.enqueue(ORDER);
    await store.sync();
    expect(store.pending()).toBe(0);
    expect(toastError).not.toHaveBeenCalled();
  });

  it('corta ante un error de red y conserva la cola para reintentar', async () => {
    createOrder.mockResolvedValue(E.left('TypeError: Failed to fetch'));
    await store.enqueue(ORDER);
    await store.enqueue(ORDER);
    await store.sync();
    expect(createOrder).toHaveBeenCalledTimes(1); // FIFO: corta en la primera
    expect(store.pending()).toBe(2);
    expect(toastError).not.toHaveBeenCalled(); // reintento silencioso al reconectar
  });

  it('un error de negocio no bloquea el resto y avisa', async () => {
    createOrder
      .mockResolvedValueOnce(E.left('order_limit_reached'))
      .mockResolvedValueOnce(E.right({}));
    await store.enqueue({ ...ORDER, totalUsd: 1 });
    await store.enqueue({ ...ORDER, totalUsd: 2 });
    await store.sync();
    expect(store.pending()).toBe(1); // la fallida queda con tries+1
    expect(toastError).toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalled(); // la otra sí subió
  });

  it('la cola es por tenant: otro tenant no ve pendientes ajenos', async () => {
    await store.enqueue(ORDER);
    await store.init(999);
    expect(store.pending()).toBe(0);
  });

  it('clasifica como red los mensajes de los 3 motores (incluido Safari)', () => {
    expect(isNetworkError('TypeError: Failed to fetch')).toBe(true); // Chrome
    expect(
      isNetworkError('TypeError: NetworkError when attempting to fetch resource.')
    ).toBe(true); // Firefox
    expect(isNetworkError('TypeError: Load failed')).toBe(true); // Safari/iPad
    expect(isNetworkError('order_limit_reached')).toBe(false);
    expect(isNetworkError('duplicate key value')).toBe(false);
  });

  it('una venta envenenada deja de reintentarse en automático pero sí en manual', async () => {
    createOrder.mockResolvedValue(E.left('order_limit_reached'));
    await store.enqueue(ORDER);
    // 5 syncs automáticos: reintenta y agota los tries
    for (let i = 0; i < 5; i++) await store.sync();
    expect(createOrder).toHaveBeenCalledTimes(5);
    await store.sync(); // auto nro 6: la saltea
    expect(createOrder).toHaveBeenCalledTimes(5);
    await store.sync(true); // manual: la vuelve a intentar
    expect(createOrder).toHaveBeenCalledTimes(6);
    expect(store.pending()).toBe(1); // sigue pendiente, visible para el usuario
  });
});
