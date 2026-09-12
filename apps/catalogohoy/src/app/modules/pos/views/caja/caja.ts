import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  EcommerceConfigStore,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { IconComponent } from '@ui';
import { PosCajaStore } from '../../pos-caja.store';

/**
 * Caja del Punto de Venta: abrir/cerrar con arqueo y seguir los saldos por medio
 * de pago de la sesión en curso. Si no hay caja abierta muestra el formulario de
 * apertura; si la hay, el resumen + el cierre con arqueo. Abajo, el historial de
 * cajas cerradas.
 */
@Component({
  selector: 'pos-caja',
  standalone: true,
  imports: [DecimalPipe, DatePipe, FormsModule, IconComponent, TranslocoPipe],
  templateUrl: './caja.html',
  styleUrl: './caja.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosCaja implements OnInit {
  readonly caja = inject(PosCajaStore);
  private readonly toast = inject(ToastService);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly configStore = inject(EcommerceConfigStore);

  readonly cs = computed(
    () =>
      this.tenantCurrency.displaySymbol() ||
      this.configStore.config()?.currencySymbol ||
      '$'
  );

  // Apertura
  readonly openingFloat = signal<number | null>(null);
  readonly registerName = signal('');

  // Cierre / arqueo
  readonly showClose = signal(false);
  readonly countedCash = signal<number | null>(null);
  readonly closeNotes = signal('');
  readonly isWorking = signal(false);

  /** Diferencia del arqueo en vivo: contado − esperado. */
  readonly closeDifference = computed(() => {
    const counted = this.countedCash();
    if (counted == null) return null;
    const expected = this.caja.summary()?.expectedCash ?? 0;
    return counted - expected;
  });

  ngOnInit(): void {
    this.caja.loadOpenSession();
    this.caja.loadHistory();
  }

  money(n: number | null | undefined): string {
    return `${this.cs()}${(n ?? 0).toFixed(2)}`;
  }

  async openCaja(): Promise<void> {
    const float = this.openingFloat();
    if (float == null || float < 0) {
      this.toast.error(new Exception('Ingresá el efectivo inicial.'));
      return;
    }
    this.isWorking.set(true);
    const res = await this.caja.open({
      openingFloat: float,
      registerName: this.registerName().trim() || null,
    });
    this.isWorking.set(false);
    res.fold(
      (error) => this.toast.error(new Exception(error)),
      () => {
        this.toast.success('Caja abierta ✓');
        this.openingFloat.set(null);
        this.registerName.set('');
      }
    );
  }

  openCloseDialog(): void {
    this.caja.refresh();
    this.countedCash.set(null);
    this.closeNotes.set('');
    this.showClose.set(true);
  }

  async confirmClose(): Promise<void> {
    const counted = this.countedCash();
    if (counted == null || counted < 0) {
      this.toast.error(new Exception('Ingresá el efectivo contado.'));
      return;
    }
    this.isWorking.set(true);
    const res = await this.caja.close({
      countedCash: counted,
      notes: this.closeNotes().trim() || null,
    });
    this.isWorking.set(false);
    res.fold(
      (error) => this.toast.error(new Exception(error)),
      () => {
        this.toast.success('Caja cerrada ✓');
        this.showClose.set(false);
        this.caja.loadHistory();
      }
    );
  }

  /** Tono del chip de diferencia (sobra/falta/cuadra). */
  diffTone(diff: number | null): 'ok' | 'over' | 'short' {
    if (diff == null || Math.abs(diff) < 0.005) return 'ok';
    return diff > 0 ? 'over' : 'short';
  }
}
