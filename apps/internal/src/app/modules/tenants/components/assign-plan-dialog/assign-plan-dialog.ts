import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogComponent, IconComponent } from '@ui';
import {
  defaultAmountUsd,
  PLAN_CYCLES,
  PLAN_TIERS,
  PlanCycle,
  PlanTier,
} from '../../../shared/plan-cycle.model';
import { Tenant } from '../../tenants.model';
import { ReferralContext, TenantsService } from '../../tenants.service';

export interface AssignPlanPayload {
  tenantId: number;
  tier: PlanTier;
  cycle: PlanCycle;
  amountUsd: number;
  consumeCreditUsd: number | null;
}

@Component({
  selector: 'app-assign-plan-dialog',
  standalone: true,
  imports: [DialogComponent, IconComponent, FormsModule, DecimalPipe],
  template: `
    <ui-dialog
      headerTitle="Asignar plan"
      styleClass="!w-[32rem] !max-w-[95vw]"
    >
      @if (currentTenant(); as tenant) {
        <div class="flex flex-col gap-5">
          <div
            class="flex items-center gap-3 pb-3 border-b border-grey-50"
          >
            @if (tenant.logo) {
              <img
                [src]="tenant.logo"
                [alt]="tenant.name ?? ''"
                referrerpolicy="no-referrer"
                class="w-12 h-12 rounded-xl object-cover shrink-0 border border-grey-50"
              />
            } @else {
              <div
                class="w-12 h-12 rounded-xl bg-primary-500 flex items-center justify-center shrink-0 text-white text-base font-semibold uppercase"
              >
                {{ initial(tenant) }}
              </div>
            }
            <div class="flex flex-col min-w-0">
              <span class="text-xs text-grey-400 uppercase font-semibold tracking-wide">
                Catálogo
              </span>
              <strong class="text-base font-semibold text-grey-700 truncate">
                {{ tenant.name ?? 'Sin nombre' }}
              </strong>
              @if (tenant.slug) {
                <span class="text-xs text-grey-400 truncate">
                  {{ tenant.slug }}.catalogohoy.com
                </span>
              }
            </div>
          </div>

          @if (referral(); as ref) {
            @if (ref.isReferred) {
              <div class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-violet-50 border border-violet-100">
                <ui-icon name="gift" size="16" styleClass="text-violet-500 mt-0.5" />
                <div class="flex flex-col text-xs leading-snug">
                  <span class="text-violet-700 font-semibold">
                    Este catálogo fue referido por
                    {{ ref.referrerName ?? ref.referrerSlug ?? '—' }}
                  </span>
                  <span class="text-violet-500">
                    @if (ref.referralStatus === 'pending') {
                      Al confirmar el primer pago, el referente recibirá $5 USD de crédito automáticamente.
                    } @else if (ref.referralStatus === 'rewarded') {
                      Reward ya acreditado.
                    } @else if (ref.referralStatus === 'expired') {
                      Referral expirado / flaggeado: no se acreditará reward.
                    } @else {
                      Status: {{ ref.referralStatus ?? '—' }}
                    }
                  </span>
                </div>
              </div>
            }
            @if (ref.creditAvailableUsd > 0) {
              <label class="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-100 cursor-pointer">
                <input
                  type="checkbox"
                  class="mt-1 accent-emerald-600"
                  [checked]="consumeCredit()"
                  (change)="consumeCredit.set(!consumeCredit())"
                />
                <div class="flex flex-col text-xs leading-snug">
                  <span class="text-emerald-700 font-semibold">
                    Consumir crédito de referidos: \${{ ref.creditAvailableUsd }} disponibles
                  </span>
                  <span class="text-emerald-600">
                    Se descontarán del monto a cobrar. El cliente paga la diferencia.
                  </span>
                </div>
              </label>
            }
          }

          <div class="flex flex-col gap-2">
            <span
              class="text-xs text-grey-400 uppercase font-semibold tracking-wide"
            >
              Tipo de plan
            </span>
            <div class="grid grid-cols-1 gap-2">
              @for (tier of tiers; track tier.tier) {
                <button
                  type="button"
                  (click)="selectedTier.set(tier.tier)"
                  class="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border transition-colors text-left cursor-pointer"
                  [class.border-primary-500]="selectedTier() === tier.tier"
                  [class.bg-primary-50]="selectedTier() === tier.tier"
                  [class.border-grey-50]="selectedTier() !== tier.tier"
                  [class.hover:border-grey-100]="selectedTier() !== tier.tier"
                >
                  <div class="flex flex-col">
                    <strong class="text-sm font-semibold text-grey-700">
                      {{ tier.label }}
                    </strong>
                    <span class="text-xs text-grey-400">
                      {{ tier.description }}
                    </span>
                  </div>
                  @if (selectedTier() === tier.tier) {
                    <ui-icon
                      name="check-circle"
                      size="18"
                      styleClass="text-primary-500 shrink-0"
                    />
                  }
                </button>
              }
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span
              class="text-xs text-grey-400 uppercase font-semibold tracking-wide"
            >
              Frecuencia
            </span>
            <div class="grid grid-cols-3 gap-2">
              @for (cycle of cycles; track cycle.cycle) {
                <button
                  type="button"
                  (click)="selectedCycle.set(cycle.cycle)"
                  class="flex flex-col items-center gap-1 px-3 py-3 rounded-lg border transition-colors cursor-pointer"
                  [class.border-primary-500]="selectedCycle() === cycle.cycle"
                  [class.bg-primary-50]="selectedCycle() === cycle.cycle"
                  [class.border-grey-50]="selectedCycle() !== cycle.cycle"
                  [class.hover:border-grey-100]="selectedCycle() !== cycle.cycle"
                >
                  <strong class="text-sm font-semibold text-grey-700">
                    {{ cycle.label }}
                  </strong>
                  <span class="text-[10px] text-grey-400">
                    {{ cycle.description }}
                  </span>
                  @if (cycle.badge) {
                    <span
                      class="inline-flex items-center px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-600 text-[9px] font-bold"
                    >
                      {{ cycle.badge }}
                    </span>
                  }
                </button>
              }
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <span
              class="text-xs text-grey-400 uppercase font-semibold tracking-wide"
            >
              Monto cobrado (USD)
            </span>
            <div
              class="flex items-center gap-2 px-3 py-2 rounded-lg border border-grey-50 focus-within:border-primary-500 transition-colors"
            >
              <span class="text-grey-400 text-sm font-semibold">$</span>
              <input
                type="number"
                min="0"
                step="0.01"
                inputmode="decimal"
                class="flex-1 outline-none text-sm text-grey-700 bg-transparent"
                [ngModel]="amountUsd()"
                (ngModelChange)="onAmountChange($event)"
              />
              <button
                type="button"
                (click)="resetAmount()"
                class="text-[10px] font-semibold text-primary-500 hover:text-primary-600 uppercase tracking-wide cursor-pointer"
              >
                Sugerido
              </button>
            </div>
            <span class="text-[11px] text-grey-400 leading-tight">
              Se guarda como monto cobrado de la suscripción. Puede ser
              <strong>0</strong> si es una cuenta de prueba o cortesía.
            </span>
            @if (creditToConsume() > 0) {
              <div class="flex items-center justify-between px-3 py-2 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold">
                <span>Crédito a consumir</span>
                <span>−\${{ creditToConsume() | number: '1.2-2' }}</span>
              </div>
              <div class="flex items-center justify-between px-3 py-2 rounded-md bg-grey-25 text-grey-700 text-sm font-bold">
                <span>Neto a cobrar al cliente</span>
                <span>\${{ netAmount() | number: '1.2-2' }}</span>
              </div>
            }
          </div>

          <div
            class="flex items-center justify-end gap-2 pt-3 border-t border-grey-50"
          >
            @if (tenant.plan.tier !== 'gratis') {
              <button
                type="button"
                (click)="onRemove()"
                class="px-4 py-2 rounded-md text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
              >
                Quitar plan
              </button>
            }
            <button
              type="button"
              (click)="hide()"
              class="px-4 py-2 rounded-md text-sm font-semibold text-grey-500 hover:bg-grey-50 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              (click)="onConfirm()"
              [disabled]="!canConfirm()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ui-icon name="check" size="14" styleClass="text-white" />
              Asignar
            </button>
          </div>
        </div>
      }
    </ui-dialog>
  `,
})
export class AssignPlanDialog {
  public readonly assign = output<AssignPlanPayload>();
  public readonly remove = output<number>();

  private readonly tenantsService = inject(TenantsService);

  protected readonly tiers = PLAN_TIERS;
  protected readonly cycles = PLAN_CYCLES;

  protected readonly currentTenant = signal<Tenant | null>(null);
  protected readonly selectedTier = signal<PlanTier>('basico');
  protected readonly selectedCycle = signal<PlanCycle>('monthly');
  protected readonly amountUsd = signal<number>(0);
  /** Tracks whether the user has manually edited the amount. */
  private readonly amountTouched = signal<boolean>(false);

  /** Contexto de referidos del tenant. Se carga cada vez que abre el dialog. */
  protected readonly referral = signal<ReferralContext | null>(null);
  /** Si el admin tildó "consumir crédito" — solo aplicable cuando este
   *  tenant es referrer con creditAvailableUsd > 0. */
  protected readonly consumeCredit = signal<boolean>(false);

  protected readonly creditToConsume = computed(() => {
    const ref = this.referral();
    if (!ref || !this.consumeCredit()) return 0;
    return Math.min(ref.creditAvailableUsd, Number(this.amountUsd()) || 0);
  });

  protected readonly netAmount = computed(
    () => Math.max(0, (Number(this.amountUsd()) || 0) - this.creditToConsume())
  );

  protected readonly canConfirm = computed(
    () =>
      !!this.selectedTier() &&
      !!this.selectedCycle() &&
      this.amountUsd() !== null &&
      this.amountUsd() !== undefined &&
      Number(this.amountUsd()) >= 0
  );

  private readonly dialog = viewChild.required(DialogComponent);

  constructor() {
    // Auto-update suggested amount when tier/cycle change and the user
    // hasn't manually edited the field.
    effect(() => {
      const tier = this.selectedTier();
      const cycle = this.selectedCycle();
      if (!this.amountTouched()) {
        this.amountUsd.set(defaultAmountUsd(tier, cycle));
      }
    });
  }

  public show(tenant: Tenant): void {
    this.currentTenant.set(tenant);
    const tier =
      tenant.plan.tier === 'gratis' ? 'basico' : tenant.plan.tier;
    const cycle = tenant.plan.cycle ?? 'monthly';
    this.amountTouched.set(false);
    this.selectedTier.set(tier);
    this.selectedCycle.set(cycle);
    this.amountUsd.set(defaultAmountUsd(tier, cycle));
    this.referral.set(null);
    this.consumeCredit.set(false);
    this.dialog().show();
    // Fire-and-forget: si tiene contexto de referidos lo mostramos.
    this.tenantsService.getReferralContext(tenant.id).then((res) => {
      res.mapRight((ctx) => this.referral.set(ctx));
    });
  }

  public hide(): void {
    this.dialog().hide();
  }

  protected resetAmount(): void {
    this.amountUsd.set(defaultAmountUsd(this.selectedTier(), this.selectedCycle()));
    this.amountTouched.set(false);
  }

  protected onAmountChange(value: number | string | null): void {
    const parsed = value === null || value === undefined || value === '' ? 0 : Number(value);
    this.amountUsd.set(Number.isFinite(parsed) ? parsed : 0);
    this.amountTouched.set(true);
  }

  protected onConfirm(): void {
    const tenant = this.currentTenant();
    if (!tenant) return;
    const consume = this.creditToConsume();
    this.assign.emit({
      tenantId: tenant.id,
      tier: this.selectedTier(),
      cycle: this.selectedCycle(),
      amountUsd: Number(this.amountUsd()) || 0,
      consumeCreditUsd: consume > 0 ? consume : null,
    });
    this.hide();
  }

  protected onRemove(): void {
    const tenant = this.currentTenant();
    if (!tenant) return;
    this.remove.emit(tenant.id);
    this.hide();
  }

  protected initial(tenant: Tenant): string {
    const source = tenant.name ?? tenant.slug ?? '?';
    return source.trim().charAt(0).toUpperCase() || '?';
  }
}
