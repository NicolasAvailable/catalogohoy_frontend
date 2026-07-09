import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { DialogComponent, IconComponent } from '@ui';
import {
  CREDITS_MAX,
  CREDITS_MIN,
  CREDITS_STEP,
  creditQuote,
  CreditsStore,
} from '../../../infrastructure';

const PRESETS = [150, 500, 1000, 2000];

/**
 * Chip de créditos de IA para el navbar: muestra el saldo (reactivo, baja al
 * consumir vía CreditsStore) y abre un diálogo para ARMAR un paquete de créditos
 * (cantidad libre con descuento por volumen) y pagarlo. También procesa el
 * retorno de Stripe (`?credits_session=`) confirmando la compra.
 */
@Component({
  selector: 'lib-credits-widget',
  imports: [IconComponent, DialogComponent, TranslocoPipe],
  templateUrl: './credits-widget.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreditsWidgetComponent implements OnInit {
  public readonly credits = inject(CreditsStore);
  private readonly toast = inject(ToastService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private readonly dialog = viewChild<DialogComponent>('buyDialog');

  public readonly presets = PRESETS;
  public readonly min = CREDITS_MIN;
  public readonly max = CREDITS_MAX;
  public readonly step = CREDITS_STEP;

  // Cantidad que el usuario está armando + cotización en vivo (precio/descuento).
  public readonly amount = signal<number>(500);
  public readonly quote = computed(() => creditQuote(this.amount()));
  public readonly busy = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    void this.credits.load();

    const sessionId = this.route.snapshot.queryParamMap.get('credits_session');
    if (sessionId) {
      const result = await this.credits.confirmPurchase(sessionId);
      result
        .mapRight((added) => {
          if (added > 0) this.toast.success(`¡${added} créditos agregados!`);
        })
        .mapLeft((e) => this.toast.error(new Exception(e.message)));
      this.router.navigate([], {
        queryParams: { credits_session: null, credits: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  open(): void {
    this.dialog()?.show();
  }

  close(): void {
    if (!this.busy()) this.dialog()?.hide();
  }

  setAmount(value: number): void {
    const clamped = Math.min(this.max, Math.max(this.min, value));
    // Ajusta al paso.
    this.amount.set(Math.round(clamped / this.step) * this.step);
  }

  inc(): void {
    this.setAmount(this.amount() + this.step);
  }

  dec(): void {
    this.setAmount(this.amount() - this.step);
  }

  /** Total formateado en dólares (p. ej. "8.93"). */
  public readonly totalLabel = computed(() => (this.quote().cents / 100).toFixed(2));
  /** Descuento en porcentaje entero (0 si no aplica). */
  public readonly discountPct = computed(() => Math.round(this.quote().discount * 100));

  async buy(): Promise<void> {
    if (this.busy()) return;
    this.busy.set(true);
    const returnUrl = window.location.origin + window.location.pathname;
    const result = await this.credits.buyCredits(this.amount(), returnUrl);
    result
      .mapRight((url) => {
        window.location.href = url; // a Stripe Checkout
      })
      .mapLeft((e) => {
        this.toast.error(new Exception(e.message));
        this.busy.set(false);
      });
  }
}
