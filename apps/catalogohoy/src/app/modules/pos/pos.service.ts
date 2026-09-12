import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { Order, OrderItem, OrderMetrics } from '@catalogohoy/order';
import { E } from '@shared/domain';
import {
  isCashMethod,
  PosCashMovement,
  PosCashMovementType,
  PosCashSession,
  PosSalesByMethod,
  PosSessionSummary,
} from './pos.models';

/** Fila cruda de `pos_cash_sessions`. */
interface CashSessionRow {
  id: number;
  tenant_id: number;
  status: 'open' | 'closed';
  opening_float: number | string | null;
  opened_by_name: string | null;
  opened_at: string;
  closed_by_name: string | null;
  closed_at: string | null;
  closing_counted: number | string | null;
  closing_expected: number | string | null;
  closing_difference: number | string | null;
  register_name: string | null;
  notes: string | null;
}

/** Fila cruda de `pos_cash_movements`. */
interface CashMovementRow {
  id: number;
  tenant_id: number;
  session_id: number;
  type: PosCashMovementType;
  amount: number | string | null;
  reason: string | null;
  created_by_name: string | null;
  created_at: string;
}

const num = (v: number | string | null | undefined): number => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Servicio de infraestructura del Punto de Venta: caja (abrir/cerrar/arqueo),
 * movimientos de efectivo, estadísticas (reusa la RPC `order_metrics` filtrando
 * `source='pos'`) y búsqueda de ventas para devoluciones. Escribe directo sobre
 * las tablas `pos_cash_sessions` / `pos_cash_movements` (RLS por tenant) y sobre
 * `orders` para la devolución (orden negativa). Devuelve `Either` como el resto
 * del repo; nunca lanza.
 */
@Injectable({ providedIn: 'root' })
export class PosService {
  private readonly client = SupabaseClientProvider.getInstance();

  private toSession(r: CashSessionRow): PosCashSession {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      status: r.status,
      openingFloat: num(r.opening_float),
      openedByName: r.opened_by_name,
      openedAt: r.opened_at,
      closedByName: r.closed_by_name,
      closedAt: r.closed_at,
      closingCounted: r.closing_counted == null ? null : num(r.closing_counted),
      closingExpected:
        r.closing_expected == null ? null : num(r.closing_expected),
      closingDifference:
        r.closing_difference == null ? null : num(r.closing_difference),
      registerName: r.register_name,
      notes: r.notes,
    };
  }

  /** Mapa mínimo fila `orders` → `Order` (solo lo que usa la devolución). El
   *  `OrderMapper` del lib no se exporta por el barrel, así que mapeamos acá. */
  private toOrder(r: Record<string, unknown>): Order {
    return {
      id: Number(r['id']),
      orderNumber: r['order_number'] != null ? Number(r['order_number']) : undefined,
      name: String(r['name'] ?? ''),
      products: (Array.isArray(r['products']) ? r['products'] : []) as OrderItem[],
      status: (r['status'] as Order['status']) ?? 'completed',
      tenantId: Number(r['tenant_id']),
      totalUsd: num(r['total_usd'] as number | string | null),
      totalBs: num(r['total_bs'] as number | string | null),
      createdAt: String(r['created_at'] ?? ''),
      updatedAt: String(r['updated_at'] ?? r['created_at'] ?? ''),
      phone: (r['phone'] as string) ?? undefined,
      paymentMethod: (r['payment_method'] as string) ?? undefined,
      deliveryDate: String(r['delivery_date'] ?? ''),
    };
  }

  private toMovement(r: CashMovementRow): PosCashMovement {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      sessionId: r.session_id,
      type: r.type,
      amount: num(r.amount),
      reason: r.reason,
      createdByName: r.created_by_name,
      createdAt: r.created_at,
    };
  }

  // ── Caja ────────────────────────────────────────────────────────────────
  /** La caja abierta del tenant (a lo sumo una), o null si no hay ninguna. */
  async getOpenSession(
    tenantId: number
  ): Promise<E.Either<Error, PosCashSession | null>> {
    const { data, error } = await this.client
      .from('pos_cash_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('status', 'open')
      .order('opened_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return E.left(new Error(error.message));
    return E.right(data ? this.toSession(data as CashSessionRow) : null);
  }

  /** Abre una caja. El índice parcial único evita dos cajas abiertas a la vez. */
  async openSession(
    tenantId: number,
    input: {
      openingFloat: number;
      openedByName?: string | null;
      registerName?: string | null;
      notes?: string | null;
    }
  ): Promise<E.Either<Error, PosCashSession>> {
    const { data, error } = await this.client
      .from('pos_cash_sessions')
      .insert({
        tenant_id: tenantId,
        status: 'open',
        opening_float: input.openingFloat ?? 0,
        opened_by_name: input.openedByName ?? null,
        register_name: input.registerName ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        return E.left(new Error('Ya hay una caja abierta.'));
      }
      return E.left(new Error(error.message));
    }
    return E.right(this.toSession(data as CashSessionRow));
  }

  /** Cierra la caja guardando el arqueo (contado/esperado/diferencia). */
  async closeSession(
    tenantId: number,
    sessionId: number,
    input: {
      countedCash: number;
      expectedCash: number;
      closedByName?: string | null;
      notes?: string | null;
    }
  ): Promise<E.Either<Error, PosCashSession>> {
    const { data, error } = await this.client
      .from('pos_cash_sessions')
      .update({
        status: 'closed',
        closed_at: new Date().toISOString(),
        closed_by_name: input.closedByName ?? null,
        closing_counted: input.countedCash,
        closing_expected: input.expectedCash,
        closing_difference: input.countedCash - input.expectedCash,
        notes: input.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .eq('tenant_id', tenantId)
      .select()
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(this.toSession(data as CashSessionRow));
  }

  /** Últimas cajas del tenant (para el historial). */
  async listSessions(
    tenantId: number,
    limit = 20
  ): Promise<E.Either<Error, PosCashSession[]>> {
    const { data, error } = await this.client
      .from('pos_cash_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('opened_at', { ascending: false })
      .limit(limit);
    if (error) return E.left(new Error(error.message));
    return E.right((data as CashSessionRow[]).map((r) => this.toSession(r)));
  }

  // ── Movimientos ───────────────────────────────────────────────────────────
  async addMovement(
    tenantId: number,
    sessionId: number,
    input: {
      type: PosCashMovementType;
      amount: number;
      reason?: string | null;
      createdByName?: string | null;
    }
  ): Promise<E.Either<Error, PosCashMovement>> {
    const { data, error } = await this.client
      .from('pos_cash_movements')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        type: input.type,
        amount: input.amount,
        reason: input.reason ?? null,
        created_by_name: input.createdByName ?? null,
      })
      .select()
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(this.toMovement(data as CashMovementRow));
  }

  async listMovements(
    tenantId: number,
    sessionId: number
  ): Promise<E.Either<Error, PosCashMovement[]>> {
    const { data, error } = await this.client
      .from('pos_cash_movements')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });
    if (error) return E.left(new Error(error.message));
    return E.right((data as CashMovementRow[]).map((r) => this.toMovement(r)));
  }

  // ── Arqueo / resumen ──────────────────────────────────────────────────────
  /** Calcula el resumen de una sesión: ventas (por medio), efectivo esperado,
   *  a partir de las órdenes imputadas a la caja + sus movimientos. */
  async getSessionSummary(
    tenantId: number,
    session: PosCashSession
  ): Promise<E.Either<Error, PosSessionSummary>> {
    // Ventas PAGADAS de la sesión (status 'completed' = cobradas en mostrador).
    const { data: sales, error: salesErr } = await this.client
      .from('orders')
      .select('payment_method, total_usd, status')
      .eq('tenant_id', tenantId)
      .eq('pos_cash_session_id', session.id)
      .eq('status', 'completed');
    if (salesErr) return E.left(new Error(salesErr.message));

    const { data: movRows, error: movErr } = await this.client
      .from('pos_cash_movements')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('session_id', session.id);
    if (movErr) return E.left(new Error(movErr.message));
    const movements = (movRows as CashMovementRow[]).map((r) =>
      this.toMovement(r)
    );

    const byMethod = new Map<string, PosSalesByMethod>();
    let totalSales = 0;
    let cashSales = 0;
    for (const row of (sales ?? []) as {
      payment_method: string | null;
      total_usd: number | string | null;
    }[]) {
      const amount = num(row.total_usd);
      const method = (row.payment_method || 'Sin especificar').trim();
      totalSales += amount;
      if (isCashMethod(method)) cashSales += amount;
      const acc = byMethod.get(method) ?? { method, count: 0, total: 0 };
      acc.count += 1;
      acc.total += amount;
      byMethod.set(method, acc);
    }

    const movementsIn = movements
      .filter((m) => m.type === 'in')
      .reduce((s, m) => s + m.amount, 0);
    const movementsOut = movements
      .filter((m) => m.type === 'out')
      .reduce((s, m) => s + m.amount, 0);

    return E.right({
      openingFloat: session.openingFloat,
      salesByMethod: Array.from(byMethod.values()).sort(
        (a, b) => b.total - a.total
      ),
      totalSales,
      salesCount: (sales ?? []).length,
      cashSales,
      movementsIn,
      movementsOut,
      expectedCash:
        session.openingFloat + cashSales + movementsIn - movementsOut,
    });
  }

  // ── Estadísticas (reusa order_metrics filtrando source='pos') ──────────────
  async getPosMetrics(
    tenantId: number,
    start: string,
    end: string,
    todayStart: string,
    useBs: boolean
  ): Promise<E.Either<Error, OrderMetrics>> {
    const { data, error } = await this.client.rpc('order_metrics', {
      p_tenant_id: tenantId,
      p_start: start,
      p_end: end,
      p_today_start: todayStart,
      p_use_bs: useBs,
      p_source: 'pos',
    });
    if (error) return E.left(new Error(error.message));
    const d = (data ?? {}) as Record<string, unknown>;
    return E.right({
      todayAmount: Number(d['todayAmount']) || 0,
      todayOrders: Number(d['todayOrders']) || 0,
      rangeTotalOrders: Number(d['rangeTotalOrders']) || 0,
      rangeTotalAmount: Number(d['rangeTotalAmount']) || 0,
      rangeAvgTicket: Number(d['rangeAvgTicket']) || 0,
      byStatus: Array.isArray(d['byStatus'])
        ? (d['byStatus'] as Record<string, unknown>[]).map((s) => ({
            status: String(s['status']),
            count: Number(s['count']) || 0,
            amount: Number(s['amount']) || 0,
          }))
        : [],
      byDay: Array.isArray(d['byDay'])
        ? (d['byDay'] as Record<string, unknown>[]).map((day) => ({
            date: String(day['date']),
            amount: Number(day['amount']) || 0,
            count: Number(day['count']) || 0,
          }))
        : [],
    });
  }

  // ── Devoluciones ──────────────────────────────────────────────────────────
  /** Ventas recientes del POS (source='pos', pagadas) para buscar y devolver.
   *  Excluye las devoluciones (total negativo). */
  async findPosOrders(
    tenantId: number,
    search: string,
    limit = 30
  ): Promise<E.Either<Error, Order[]>> {
    let query = this.client
      .from('orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('source', 'pos')
      .eq('status', 'completed')
      .gt('total_usd', 0)
      .order('created_at', { ascending: false })
      .limit(limit);

    const q = search.trim();
    if (q) {
      // Por número de orden (#N) o por nombre del cliente.
      const asNumber = Number(q.replace(/^#/, ''));
      if (Number.isFinite(asNumber) && asNumber > 0) {
        query = query.eq('order_number', asNumber);
      } else {
        query = query.ilike('name', `%${q}%`);
      }
    }

    const { data, error } = await query;
    if (error) return E.left(new Error(error.message));
    return E.right(
      ((data || []) as Record<string, unknown>[]).map((r) => this.toOrder(r))
    );
  }

  /**
   * Procesa la devolución de una venta del POS:
   *  1) repone el stock de los ítems devueltos (RPC `increment_product_stock`);
   *  2) registra una **orden negativa** (`source='pos'`, `status='completed'`)
   *     con el mismo medio de pago, para que las estadísticas reflejen el neto y
   *     la caja descuente el reembolso en efectivo automáticamente.
   * No usa `OrderStore.createOrder` a propósito: esa ruta DESCUENTA stock, y acá
   * queremos reponerlo.
   */
  async processReturn(
    tenantId: number,
    original: Order,
    items: OrderItem[],
    input: {
      restock: boolean;
      paymentMethod?: string | null;
      sessionId?: number | null;
      reason?: string | null;
    }
  ): Promise<E.Either<Error, void>> {
    if (!items.length) return E.left(new Error('Seleccioná al menos un ítem.'));

    const refundTotal = items.reduce((s, it) => s + (it.total ?? 0), 0);
    if (refundTotal <= 0) return E.left(new Error('El monto a devolver es 0.'));

    // 1) Reponer inventario de los ítems devueltos.
    if (input.restock) {
      const payload = items
        .filter((it) => !it.isCustom)
        .map((it) => ({
          productId: it.productId,
          quantity: it.quantity ?? 0,
          size: it.size ?? null,
          variantId: it.variantId ?? null,
        }));
      if (payload.length) {
        const { error: rpcErr } = await this.client.rpc(
          'increment_product_stock',
          { p_tenant_id: tenantId, p_items: payload }
        );
        if (rpcErr) return E.left(new Error(rpcErr.message));
      }
    }

    // 2) Orden negativa (devolución). Insert directo para NO descontar stock.
    const negativeItems = items.map((it) => ({
      ...it,
      quantity: -Math.abs(it.quantity ?? 1),
      total: -Math.abs(it.total ?? 0),
    }));
    const refLabel = original.orderNumber ?? original.id;
    const { error } = await this.client.from('orders').insert({
      tenant_id: tenantId,
      name: `Devolución #${refLabel}${original.name ? ` — ${original.name}` : ''}`,
      phone: original.phone ?? null,
      products: negativeItems,
      status: 'completed',
      total_usd: -Math.abs(refundTotal),
      total_bs: original.totalBs
        ? -Math.abs(
            (Math.abs(refundTotal) / Math.max(original.totalUsd, 1)) *
              original.totalBs
          )
        : 0,
      source: 'pos',
      payment_method: input.paymentMethod ?? original.paymentMethod ?? null,
      pos_cash_session_id: input.sessionId ?? null,
      comments: input.reason
        ? `Devolución: ${input.reason}`
        : `Devolución de la venta #${refLabel}`,
    });
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }
}
