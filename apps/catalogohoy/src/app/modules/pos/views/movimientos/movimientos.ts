import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  EcommerceConfigStore,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { IconComponent } from '@ui';
import { PosCajaStore } from '../../pos-caja.store';
import { PosCashMovementType } from '../../pos.models';

/**
 * Movimientos de caja: ingresos y egresos de efectivo de la sesión abierta
 * (aportes, retiros, pago a proveedor, etc.). Sin caja abierta, invita a abrir
 * una en la sección Caja. Los movimientos alimentan el arqueo (efectivo
 * esperado).
 */
@Component({
  selector: 'pos-movimientos',
  standalone: true,
  imports: [DatePipe, FormsModule, RouterLink, IconComponent, TranslocoPipe],
  templateUrl: './movimientos.html',
  styleUrl: './movimientos.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class PosMovimientos implements OnInit {
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

  readonly type = signal<PosCashMovementType>('in');
  readonly amount = signal<number | null>(null);
  readonly reason = signal('');
  readonly isWorking = signal(false);

  ngOnInit(): void {
    this.caja.loadOpenSession();
  }

  money(n: number | null | undefined): string {
    return `${this.cs()}${(n ?? 0).toFixed(2)}`;
  }

  setType(t: PosCashMovementType): void {
    this.type.set(t);
  }

  async add(): Promise<void> {
    const amt = this.amount();
    if (amt == null || amt <= 0) {
      this.toast.error(new Exception('Ingresá un monto mayor a 0.'));
      return;
    }
    this.isWorking.set(true);
    const res = await this.caja.addMovement({
      type: this.type(),
      amount: amt,
      reason: this.reason().trim() || null,
    });
    this.isWorking.set(false);
    res.fold(
      (error) => this.toast.error(new Exception(error)),
      () => {
        this.toast.success(
          this.type() === 'in' ? 'Ingreso registrado ✓' : 'Egreso registrado ✓'
        );
        this.amount.set(null);
        this.reason.set('');
      }
    );
  }
}
