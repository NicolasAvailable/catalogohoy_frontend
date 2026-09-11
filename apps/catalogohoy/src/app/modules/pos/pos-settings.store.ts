import { computed } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

/** Un medio de pago configurable del POS (Configuración → Medios de pago). */
export interface PosPayMethodSetting {
  id: string;
  label: string;
  icon: string;
  enabled: boolean;
  /** Ajuste % que se aplica al total con este medio: positivo = recargo,
   *  negativo = descuento. 0 = sin ajuste. */
  adjustPercent: number;
}

export interface PosTicketSettings {
  header: string;
  footer: string;
  /** Logo en data-URL (se guarda en localStorage; usar imágenes chicas). */
  logo: string | null;
  printLogo: boolean;
}

export interface PosPrinterSettings {
  connected: boolean;
  width: '58' | '80';
  deviceName: string;
}

interface PosSettingsState {
  tenantKey: string;
  methods: PosPayMethodSetting[];
  ticket: PosTicketSettings;
  printer: PosPrinterSettings;
  loaded: boolean;
}

const DEFAULT_METHODS: PosPayMethodSetting[] = [
  { id: 'efectivo', label: 'Efectivo', icon: 'banknote', enabled: true, adjustPercent: 0 },
  { id: 'credito', label: 'Tarjeta de crédito', icon: 'credit-card', enabled: true, adjustPercent: 0 },
  { id: 'debito', label: 'Tarjeta de débito', icon: 'credit-card', enabled: true, adjustPercent: 0 },
  { id: 'transferencia', label: 'Transferencia', icon: 'wallet', enabled: true, adjustPercent: 0 },
  { id: 'pago-movil', label: 'Pago móvil', icon: 'smartphone', enabled: false, adjustPercent: 0 },
];

const initialState: PosSettingsState = {
  tenantKey: '',
  methods: DEFAULT_METHODS,
  ticket: { header: '', footer: '¡Gracias por su compra!', logo: null, printLogo: true },
  printer: { connected: false, width: '80', deviceName: '' },
  loaded: false,
};

const storageKey = (tenantKey: string) => `pos-settings:${tenantKey || 'default'}`;

/**
 * Ajustes del Punto de Venta (impresora, medios de pago, tickets), persistidos
 * en `localStorage` por tenant. Sin DB por ahora — la persistencia server-side
 * (tabla `pos_settings`) es follow-up. `providedIn: 'root'` para compartirlos
 * entre la Configuración y la pantalla de Venta (medios habilitados).
 */
export const PosSettingsStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((s) => ({
    enabledMethods: computed(() => s.methods().filter((m) => m.enabled)),
  })),
  withMethods((store) => {
    const write = () => {
      try {
        localStorage.setItem(
          storageKey(store.tenantKey()),
          JSON.stringify({
            methods: store.methods(),
            ticket: store.ticket(),
            printer: store.printer(),
          })
        );
      } catch {
        /* localStorage lleno o no disponible: se ignora (no es crítico). */
      }
    };
    return {
      /** Carga los ajustes guardados del tenant (o los defaults). Idempotente. */
      load(tenantKey: string): void {
        let saved: Partial<PosSettingsState> | null = null;
        try {
          const raw = localStorage.getItem(storageKey(tenantKey));
          if (raw) saved = JSON.parse(raw) as Partial<PosSettingsState>;
        } catch {
          saved = null;
        }
        patchState(store, {
          tenantKey,
          // Fusiona los medios guardados con los defaults por id (para no perder
          // medios nuevos si en el futuro agregamos alguno al set por defecto).
          methods: saved?.methods?.length
            ? DEFAULT_METHODS.map(
                (d) => saved!.methods!.find((m) => m.id === d.id) ?? d
              )
            : DEFAULT_METHODS,
          ticket: { ...initialState.ticket, ...(saved?.ticket ?? {}) },
          printer: { ...initialState.printer, ...(saved?.printer ?? {}) },
          loaded: true,
        });
      },
      toggleMethod(id: string): void {
        patchState(store, (st) => ({
          methods: st.methods.map((m) =>
            m.id === id ? { ...m, enabled: !m.enabled } : m
          ),
        }));
        write();
      },
      setMethodAdjust(id: string, adjustPercent: number): void {
        const pct = Math.max(-100, Math.min(100, adjustPercent || 0));
        patchState(store, (st) => ({
          methods: st.methods.map((m) =>
            m.id === id ? { ...m, adjustPercent: pct } : m
          ),
        }));
        write();
      },
      setPrinterConnected(connected: boolean, deviceName = ''): void {
        patchState(store, (st) => ({
          printer: { ...st.printer, connected, deviceName },
        }));
        write();
      },
      setPrinterWidth(width: '58' | '80'): void {
        patchState(store, (st) => ({ printer: { ...st.printer, width } }));
        write();
      },
      setTicketHeader(header: string): void {
        patchState(store, (st) => ({ ticket: { ...st.ticket, header } }));
        write();
      },
      setTicketFooter(footer: string): void {
        patchState(store, (st) => ({ ticket: { ...st.ticket, footer } }));
        write();
      },
      setTicketLogo(logo: string | null): void {
        patchState(store, (st) => ({ ticket: { ...st.ticket, logo } }));
        write();
      },
      setPrintLogo(printLogo: boolean): void {
        patchState(store, (st) => ({ ticket: { ...st.ticket, printLogo } }));
        write();
      },
    };
  })
);
