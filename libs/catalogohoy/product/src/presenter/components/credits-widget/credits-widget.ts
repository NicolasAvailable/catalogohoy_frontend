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
import { CreditPack, isNativeApp, RevenueCatService } from '@catalogohoy/core';
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

  /**
   * En la app nativa (iOS/Android) los créditos son un bien digital: Apple
   * (3.1.1) y Google Play exigen su compra in-app: en la app se venden
   * paquetes fijos por RevenueCat y NUNCA se ofrece el pago con Stripe.
   */
  public readonly isNative = isNativeApp();
  private readonly revenueCat = inject(RevenueCatService);
  /** Paquetes de la tienda (solo nativo). null = cargando. */
  public readonly packs = signal<CreditPack[] | null>(null);
  /** Id del paquete que se está comprando (bloquea el resto). */
  public readonly buyingId = signal<string | null>(null);

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
    if (this.isNative && !this.packs()?.length) void this.loadPacks();
  }

  private async loadPacks(): Promise<void> {
    this.packs.set(null);
    this.packs.set(await this.revenueCat.getCreditPacks());
  }

  /** Compra in-app (Apple / Google) de un paquete. El webhook de RevenueCat
   *  suma los créditos en el servidor; acá esperamos a ver el saldo nuevo. */
  async buyPack(pack: CreditPack): Promise<void> {
    if (this.buyingId()) return;
    this.buyingId.set(pack.id);
    const before = this.credits.balance() ?? 0;
    const outcome = await this.revenueCat.purchaseCreditPack(pack);
    if (outcome.cancelled) {
      this.buyingId.set(null);
      return;
    }
    if (!outcome.ok) {
      this.buyingId.set(null);
      this.toast.error(new Exception('No se pudo completar la compra. Intenta de nuevo.'));
      return;
    }
    // El webhook tarda unos segundos: refrescamos el saldo hasta verlo subir.
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      await this.credits.load();
      if ((this.credits.balance() ?? 0) > before) break;
    }
    this.buyingId.set(null);
    if ((this.credits.balance() ?? 0) > before) {
      this.toast.success(`¡${pack.credits} créditos agregados!`);
      this.dialog()?.hide();
    } else {
      this.toast.success('Compra recibida. Tus créditos aparecerán en unos minutos.');
    }
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
