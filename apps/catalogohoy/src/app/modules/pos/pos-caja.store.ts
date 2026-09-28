import { computed, inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { E } from '@shared/domain';
import {
  PosCashMovement,
  PosCashMovementType,
  PosCashSession,
  PosSessionSummary,
} from './pos.models';
import { PosService } from './pos.service';

interface PosCajaState {
  /** Caja abierta del tenant (o null si no hay ninguna). */
  session: PosCashSession | null;
  movements: PosCashMovement[];
  summary: PosSessionSummary | null;
  /** Historial de cajas cerradas recientes. */
  history: PosCashSession[];
  isLoading: boolean;
  /** Ya intentamos cargar al menos una vez (para distinguir "cargando" de
   *  "no hay caja" y no mostrar el badge "Sin caja" en el primer frame). */
  loaded: boolean;
  error: string | null;
}

const initialState: PosCajaState = {
  session: null,
  movements: [],
  summary: null,
  history: [],
  isLoading: false,
  loaded: false,
  error: null,
};

/**
 * Estado de la caja del Punto de Venta. `providedIn: 'root'` para que la sesión
 * abierta se comparta entre la Venta (que imputa cada venta a la caja), la
 * sección Caja (apertura/cierre/arqueo) y Movimientos.
 */
export const PosCajaStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((s) => ({
    hasOpenSession: computed(() => s.session() != null),
    openSessionId: computed(() => s.session()?.id ?? null),
  })),
  withMethods(
    (
      store,
      posService = inject(PosService),
      tenantStore = inject(TenantStore)
    ) => {
      const refreshSummary = async (tenantId: number) => {
        const session = store.session();
        if (!session) {
          patchState(store, { summary: null });
          return;
        }
        const res = await posService.getSessionSummary(tenantId, session);
        res.fold(
          () => patchState(store, { summary: null }),
          (summary) => patchState(store, { summary })
        );
      };

      const refreshMovements = async (tenantId: number) => {
        const session = store.session();
        if (!session) {
          patchState(store, { movements: [] });
          return;
        }
        const res = await posService.listMovements(tenantId, session.id);
        res.fold(
          () => patchState(store, { movements: [] }),
          (movements) => patchState(store, { movements })
        );
      };

      return {
        /** Carga la caja abierta + su resumen/movimientos. Idempotente. */
        async loadOpenSession() {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) {
            patchState(store, { loaded: true });
            return;
          }
          patchState(store, { isLoading: true });
          const res = await posService.getOpenSession(tenantId);
          await res.fold(
            (error) =>
              patchState(store, {
                isLoading: false,
                loaded: true,
                error: error.message,
              }),
            async (session) => {
              patchState(store, { session, isLoading: false, loaded: true });
              if (session) {
                await refreshMovements(tenantId);
                await refreshSummary(tenantId);
              } else {
                patchState(store, { movements: [], summary: null });
              }
            }
          );
        },

        /** Abre una caja con un efectivo inicial. */
        async open(input: {
          openingFloat: number;
          openedByName?: string | null;
          registerName?: string | null;
          notes?: string | null;
        }): Promise<E.Either<string, PosCashSession>> {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return E.left('No se pudo obtener el tenant');
          const res = await posService.openSession(tenantId, input);
          return res.fold(
            (error) => E.left(error.message),
            (session) => {
              patchState(store, {
                session,
                movements: [],
                summary: {
                  openingFloat: session.openingFloat,
                  salesByMethod: [],
                  totalSales: 0,
                  salesCount: 0,
                  cashSales: 0,
                  movementsIn: 0,
                  movementsOut: 0,
                  expectedCash: session.openingFloat,
                },
              });
              return E.right(session);
            }
          );
        },

        /** Cierra la caja con el efectivo contado (arqueo). El esperado sale del
         *  resumen vigente. */
        async close(input: {
          countedCash: number;
          closedByName?: string | null;
          notes?: string | null;
        }): Promise<E.Either<string, PosCashSession>> {
          const tenantId = await tenantStore.getTenantIdAsync();
          const session = store.session();
          if (!tenantId) return E.left('No se pudo obtener el tenant');
          if (!session) return E.left('No hay caja abierta.');
          // Recalcula el resumen justo antes de cerrar para no usar cifras viejas.
          await refreshSummary(tenantId);
          const expected = store.summary()?.expectedCash ?? session.openingFloat;
          const res = await posService.closeSession(tenantId, session.id, {
            countedCash: input.countedCash,
            expectedCash: expected,
            closedByName: input.closedByName,
            notes: input.notes,
          });
          return res.fold(
            (error) => E.left(error.message),
            (closed) => {
              patchState(store, {
                session: null,
                movements: [],
                summary: null,
                history: [closed, ...store.history()],
              });
              return E.right(closed);
            }
          );
        },

        /** Registra un ingreso/egreso de efectivo en la caja abierta. */
        async addMovement(input: {
          type: PosCashMovementType;
          amount: number;
          reason?: string | null;
          createdByName?: string | null;
        }): Promise<E.Either<string, PosCashMovement>> {
          const tenantId = await tenantStore.getTenantIdAsync();
          const session = store.session();
          if (!tenantId) return E.left('No se pudo obtener el tenant');
          if (!session) return E.left('Abrí una caja para registrar movimientos.');
          const res = await posService.addMovement(tenantId, session.id, input);
          return res.fold(
            (error) => E.left(error.message),
            (movement) => {
              patchState(store, { movements: [movement, ...store.movements()] });
              // Actualiza el esperado en segundo plano.
              refreshSummary(tenantId);
              return E.right(movement);
            }
          );
        },

        /** Refresca el resumen/arqueo (p. ej. tras cobrar una venta). */
        async refresh() {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return;
          await refreshSummary(tenantId);
        },

        /** Carga el historial de cajas cerradas. */
        async loadHistory() {
          const tenantId = await tenantStore.getTenantIdAsync();
          if (!tenantId) return;
          const res = await posService.listSessions(tenantId, 20);
          res.fold(
            () => undefined,
            (sessions) =>
              patchState(store, {
                history: sessions.filter((s) => s.status === 'closed'),
              })
          );
        },
      };
    }
  )
);
