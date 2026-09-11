import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { OrderItem } from '@catalogohoy/order';

/** Una línea del carrito del POS. Extiende {@link OrderItem} (la misma forma que
 *  persiste la orden) con una `key` de identidad para hacer merge/borrado en el
 *  carrito y el stock disponible que se mostró al agregarla. */
export interface PosCartLine extends OrderItem {
  /** Identidad de línea: producto + variante + talla. Dos "clicks" al mismo
   *  producto/variante/talla suman cantidad en vez de duplicar la fila. */
  key: string;
  /** Stock disponible al momento de agregar (para el chip). null = ilimitado. */
  available?: number | null;
}

/** Borrador para agregar una línea: todo lo de la línea menos lo que el store
 *  calcula (`key`, `total`) y con la cantidad opcional (default 1). */
export type PosCartDraft = Omit<PosCartLine, 'key' | 'total' | 'quantity'> & {
  quantity?: number;
};

interface PosCartState {
  lines: PosCartLine[];
  /** Cliente asociado a la venta (opcional). */
  customerName: string;
  customerPhone: string;
  /** Nota libre que viaja como `comments` de la orden. */
  note: string;
  /** Descuento global de la venta, en % (0–100). */
  discountPercent: number;
  /** Medio de pago elegido en el modal de cobro. */
  paymentMethod: string;
}

const initialState: PosCartState = {
  lines: [],
  customerName: '',
  customerPhone: '',
  note: '',
  discountPercent: 0,
  paymentMethod: '',
};

/** Clave de identidad de una línea (producto + variante + talla). */
const lineKey = (l: {
  productId: string | number;
  variantId?: string | null;
  size?: string | null;
}): string => `${l.productId}|${l.variantId ?? ''}|${l.size ?? ''}`;

const clampPct = (p: number) => Math.max(0, Math.min(100, p || 0));

/**
 * Estado del carrito del Punto de Venta. `providedIn: 'root'` para que la venta
 * en curso sobreviva al navegar entre secciones del POS (Venta ↔ Caja ↔ …).
 */
export const PosCartStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((s) => ({
    /** Unidades totales en el carrito. */
    count: computed(() => s.lines().reduce((n, l) => n + l.quantity, 0)),
    /** Suma de las líneas (sin descuento). */
    subtotal: computed(() => s.lines().reduce((t, l) => t + l.total, 0)),
    /** Monto del descuento global aplicado sobre el subtotal. */
    discountAmount: computed(() => {
      const st = s.lines().reduce((t, l) => t + l.total, 0);
      return (st * clampPct(s.discountPercent())) / 100;
    }),
    /** Total a cobrar = subtotal − descuento (nunca baja de 0). */
    total: computed(() => {
      const st = s.lines().reduce((t, l) => t + l.total, 0);
      return Math.max(0, st - (st * clampPct(s.discountPercent())) / 100);
    }),
    isEmpty: computed(() => s.lines().length === 0),
  })),
  withMethods((store) => ({
    /** Agrega un producto/variante/talla al carrito (o suma cantidad si ya está). */
    addLine(draft: PosCartDraft): void {
      const key = lineKey(draft);
      const qty = draft.quantity ?? 1;
      patchState(store, (st) => {
        const existing = st.lines.find((l) => l.key === key);
        if (existing) {
          return {
            lines: st.lines.map((l) =>
              l.key === key
                ? { ...l, quantity: l.quantity + qty, total: l.price * (l.quantity + qty) }
                : l
            ),
          };
        }
        const line: PosCartLine = {
          ...draft,
          key,
          quantity: qty,
          total: draft.price * qty,
        };
        return { lines: [...st.lines, line] };
      });
    },
    /** Fija la cantidad de una línea (mín. 1). */
    setQuantity(key: string, quantity: number): void {
      const q = Math.max(1, Math.floor(quantity || 1));
      patchState(store, (st) => ({
        lines: st.lines.map((l) =>
          l.key === key ? { ...l, quantity: q, total: l.price * q } : l
        ),
      }));
    },
    /** +1 unidad. */
    increment(key: string): void {
      patchState(store, (st) => ({
        lines: st.lines.map((l) =>
          l.key === key
            ? { ...l, quantity: l.quantity + 1, total: l.price * (l.quantity + 1) }
            : l
        ),
      }));
    },
    /** −1 unidad; al llegar a 0 quita la línea. */
    decrement(key: string): void {
      patchState(store, (st) => ({
        lines: st.lines
          .map((l) =>
            l.key === key
              ? { ...l, quantity: l.quantity - 1, total: l.price * (l.quantity - 1) }
              : l
          )
          .filter((l) => l.quantity > 0),
      }));
    },
    remove(key: string): void {
      patchState(store, (st) => ({
        lines: st.lines.filter((l) => l.key !== key),
      }));
    },
    setCustomer(name: string, phone = ''): void {
      patchState(store, { customerName: name, customerPhone: phone });
    },
    setNote(note: string): void {
      patchState(store, { note });
    },
    setDiscountPercent(discountPercent: number): void {
      patchState(store, { discountPercent: clampPct(discountPercent) });
    },
    setPaymentMethod(paymentMethod: string): void {
      patchState(store, { paymentMethod });
    },
    /** Vacía el carrito tras cobrar (o al descartar la venta). */
    clear(): void {
      patchState(store, initialState);
    },
  }))
);
