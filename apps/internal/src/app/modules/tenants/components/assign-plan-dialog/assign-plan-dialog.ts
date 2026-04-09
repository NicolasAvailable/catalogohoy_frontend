import {
  Component,
  computed,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { DialogComponent, IconComponent } from '@ui';
import {
  PLAN_CYCLES,
  PLAN_TIERS,
  PlanCycle,
  PlanTier,
} from '../../../shared/plan-cycle.model';
import { Tenant } from '../../tenants.model';

export interface AssignPlanPayload {
  tenantId: number;
  tier: PlanTier;
  cycle: PlanCycle;
}

@Component({
  selector: 'app-assign-plan-dialog',
  standalone: true,
  imports: [DialogComponent, IconComponent],
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

  protected readonly tiers = PLAN_TIERS;
  protected readonly cycles = PLAN_CYCLES;

  protected readonly currentTenant = signal<Tenant | null>(null);
  protected readonly selectedTier = signal<PlanTier>('basico');
  protected readonly selectedCycle = signal<PlanCycle>('monthly');

  protected readonly canConfirm = computed(
    () => !!this.selectedTier() && !!this.selectedCycle()
  );

  private readonly dialog = viewChild.required(DialogComponent);

  public show(tenant: Tenant): void {
    this.currentTenant.set(tenant);
    const tier =
      tenant.plan.tier === 'gratis' ? 'basico' : tenant.plan.tier;
    this.selectedTier.set(tier);
    this.selectedCycle.set(tenant.plan.cycle ?? 'monthly');
    this.dialog().show();
  }

  public hide(): void {
    this.dialog().hide();
  }

  protected onConfirm(): void {
    const tenant = this.currentTenant();
    if (!tenant) return;
    this.assign.emit({
      tenantId: tenant.id,
      tier: this.selectedTier(),
      cycle: this.selectedCycle(),
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
