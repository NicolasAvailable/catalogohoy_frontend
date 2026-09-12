import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  EcommerceConfigStore,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { OrderMetrics } from '@catalogohoy/order';
import { RateStore } from '@catalogohoy/rate';
import { TenantStore } from '@catalogohoy/tenant';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { PosService } from '../../pos.service';

type Preset = 'today' | 'last_7' | 'last_30' | 'last_90';

interface PresetOption {
  key: Preset;
  label: string;
}

/**
 * Estadísticas del Punto de Venta: facturación, ventas y ticket promedio por
 * rango de fecha + gráfico de ventas por día. Reusa la RPC `order_metrics`
 * filtrando `source='pos'` (ventas de mostrador). Las devoluciones (órdenes
 * negativas) ya restan del neto. En VE, alterna montos en Bs.
 */
@Component({
  selector: 'pos-estadisticas',
  standalone: true,
  imports: [DecimalPipe, DatePipe, IconComponent, TranslocoPipe],
  templateUrl: './estadisticas.html',
  styleUrl: './estadisticas.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosEstadisticas implements OnInit {
  private readonly posService = inject(PosService);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly rateStore = inject(RateStore);

  readonly presets: PresetOption[] = [
    { key: 'today', label: 'Hoy' },
    { key: 'last_7', label: '7 días' },
    { key: 'last_30', label: '30 días' },
    { key: 'last_90', label: '90 días' },
  ];

  readonly preset = signal<Preset>('last_7');
  readonly useBs = signal(false);
  readonly isLoading = signal(false);
  readonly metrics = signal<OrderMetrics | null>(null);
  private tenantId: number | null = null;

  /** Símbolo a mostrar: Bs si está activo, si no la moneda de referencia. */
  readonly cs = computed(() =>
    this.useBs()
      ? 'Bs '
      : this.tenantCurrency.displaySymbol() ||
        this.configStore.config()?.currencySymbol ||
        '$'
  );

  /** Bs solo tiene sentido si hay tasa activa (Venezuela). */
  readonly bsAvailable = computed(() => (this.rateStore.rate()?.bcv_usd ?? 0) > 0);

  /** Máximo del gráfico por día (para escalar las barras). */
  readonly maxDay = computed(() =>
    Math.max(1, ...(this.metrics()?.byDay ?? []).map((d) => Math.abs(d.amount)))
  );

  ngOnInit(): void {
    this.rateStore.loadRates();
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (!tid) return;
      this.tenantId = tid;
      this.tenantCurrency.load(tid);
      this.configStore.loadConfig(String(tid));
      this.reload();
    });
  }

  money(n: number | null | undefined): string {
    return `${this.cs()}${(n ?? 0).toFixed(2)}`;
  }

  setPreset(p: Preset): void {
    if (this.preset() === p) return;
    this.preset.set(p);
    this.reload();
  }

  toggleBs(): void {
    this.useBs.update((v) => !v);
    this.reload();
  }

  /** Ventana [start, end) + inicio de hoy, en la zona local del admin. La RPC
   *  usa `end` exclusivo y arma los buckets por día con generate_series. */
  private buildRange(): { start: string; end: string; todayStart: string } {
    const startOfDay = (d: Date) => {
      const x = new Date(d);
      x.setHours(0, 0, 0, 0);
      return x;
    };
    const today0 = startOfDay(new Date());
    const tomorrow0 = new Date(today0);
    tomorrow0.setDate(tomorrow0.getDate() + 1);
    const start = new Date(today0);
    const back: Record<Preset, number> = {
      today: 0,
      last_7: 6,
      last_30: 29,
      last_90: 89,
    };
    start.setDate(start.getDate() - back[this.preset()]);
    return {
      start: start.toISOString(),
      end: tomorrow0.toISOString(),
      todayStart: today0.toISOString(),
    };
  }

  async reload(): Promise<void> {
    if (!this.tenantId) return;
    this.isLoading.set(true);
    const { start, end, todayStart } = this.buildRange();
    const res = await this.posService.getPosMetrics(
      this.tenantId,
      start,
      end,
      todayStart,
      this.useBs()
    );
    this.isLoading.set(false);
    res.fold(
      () => this.metrics.set(null),
      (m) => this.metrics.set(m)
    );
  }

  /** Alto relativo (%) de una barra del gráfico. */
  barHeight(amount: number): number {
    return Math.round((Math.abs(amount) / this.maxDay()) * 100);
  }
}
