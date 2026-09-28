import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import { Plan, PlanUpdate } from './plans.model';
import { PlansStore } from './plans.store';

type Draft = {
  name: string;
  description: string;
  price: number;
  maxProducts: number;
  maxCatalogs: number;
  maxTeamMembers: number;
  stripePriceIdMonthly: string;
  stripePriceIdQuarterly: string;
  stripePriceIdAnnual: string;
};

const toDraft = (plan: Plan): Draft => ({
  name: plan.name,
  description: plan.description ?? '',
  price: plan.price,
  maxProducts: plan.maxProducts,
  maxCatalogs: plan.maxCatalogs,
  maxTeamMembers: plan.maxTeamMembers ?? 0,
  stripePriceIdMonthly: plan.stripePriceIdMonthly ?? '',
  stripePriceIdQuarterly: plan.stripePriceIdQuarterly ?? '',
  stripePriceIdAnnual: plan.stripePriceIdAnnual ?? '',
});

@Component({
  selector: 'app-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IconComponent, FormsModule],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex items-start justify-between gap-3">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-bold text-grey-700">Planes</h1>
          <p class="text-sm text-grey-400">
            Editá nombre, descripción, precio mensual y límites de cada plan.
            El precio mensual es la base: trimestral aplica 5% OFF y anual 50% OFF
            OFF automáticamente al asignar.
          </p>
        </div>
        <button
          type="button"
          (click)="store.load()"
          class="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white border border-grey-50 hover:bg-grey-50 transition-colors cursor-pointer shrink-0"
          aria-label="Recargar"
        >
          <ui-icon name="refresh-cw" size="14" styleClass="text-grey-500" />
        </button>
      </header>

      @if (store.error()) {
        <div
          class="flex items-center gap-2 px-4 py-3 rounded-md bg-red-50 border border-red-100"
        >
          <ui-icon name="circle-alert" size="16" styleClass="text-red-500" />
          <span class="text-sm text-red-600">{{ store.error() }}</span>
        </div>
      }

      @if (store.isLoading() && store.plans().length === 0) {
        <div class="flex flex-col items-center gap-2 py-12">
          <ui-icon
            name="loader-circle"
            size="24"
            styleClass="text-grey-300 animate-spin"
          />
          <p class="text-sm text-grey-400">Cargando planes...</p>
        </div>
      } @else {
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-4">
          @for (plan of store.plans(); track plan.id) {
            @let draft = drafts()[plan.id];
            @let dirty = isDirty(plan);
            <article
              class="flex flex-col gap-4 p-5 bg-white rounded-xl border border-grey-50"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="flex flex-col min-w-0">
                  <span
                    class="text-xs uppercase tracking-wide font-semibold text-grey-400"
                  >
                    ID · {{ plan.id }}
                  </span>
                  <strong class="text-lg font-bold text-grey-700 truncate">
                    {{ plan.name }}
                  </strong>
                </div>
                @if (plan.isFree) {
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded bg-grey-50 text-grey-500 text-[10px] font-semibold"
                  >
                    Gratis
                  </span>
                } @else {
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded bg-primary-50 text-primary-600 text-[10px] font-semibold"
                  >
                    Pago
                  </span>
                }
              </div>

              <div class="flex flex-col gap-3">
                <label class="flex flex-col gap-1">
                  <span class="text-[11px] uppercase tracking-wide font-semibold text-grey-400">
                    Nombre
                  </span>
                  <input
                    type="text"
                    class="px-3 py-2 rounded-md border border-grey-50 outline-none text-sm text-grey-700 focus:border-primary-500 transition-colors"
                    [ngModel]="draft.name"
                    (ngModelChange)="patchDraft(plan.id, { name: $event })"
                  />
                </label>

                <label class="flex flex-col gap-1">
                  <span class="text-[11px] uppercase tracking-wide font-semibold text-grey-400">
                    Descripción
                  </span>
                  <textarea
                    rows="2"
                    class="px-3 py-2 rounded-md border border-grey-50 outline-none text-sm text-grey-700 focus:border-primary-500 transition-colors resize-none"
                    [ngModel]="draft.description"
                    (ngModelChange)="patchDraft(plan.id, { description: $event })"
                  ></textarea>
                </label>

                <label class="flex flex-col gap-1">
                  <span class="text-[11px] uppercase tracking-wide font-semibold text-grey-400">
                    Precio mensual (USD)
                  </span>
                  <div
                    class="flex items-center gap-2 px-3 py-2 rounded-md border border-grey-50 focus-within:border-primary-500 transition-colors"
                  >
                    <span class="text-grey-400 text-sm font-semibold">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      inputmode="decimal"
                      class="flex-1 outline-none text-sm text-grey-700 bg-transparent"
                      [ngModel]="draft.price"
                      (ngModelChange)="patchDraft(plan.id, { price: +$event })"
                    />
                  </div>
                </label>

                <div class="grid grid-cols-3 gap-2">
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] uppercase tracking-wide font-semibold text-grey-400">
                      Productos
                    </span>
                    <input
                      type="number"
                      min="0"
                      class="px-3 py-2 rounded-md border border-grey-50 outline-none text-sm text-grey-700 focus:border-primary-500 transition-colors"
                      [ngModel]="draft.maxProducts"
                      (ngModelChange)="patchDraft(plan.id, { maxProducts: +$event })"
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] uppercase tracking-wide font-semibold text-grey-400">
                      Catálogos
                    </span>
                    <input
                      type="number"
                      min="0"
                      class="px-3 py-2 rounded-md border border-grey-50 outline-none text-sm text-grey-700 focus:border-primary-500 transition-colors"
                      [ngModel]="draft.maxCatalogs"
                      (ngModelChange)="patchDraft(plan.id, { maxCatalogs: +$event })"
                    />
                  </label>
                  <label class="flex flex-col gap-1">
                    <span class="text-[11px] uppercase tracking-wide font-semibold text-grey-400">
                      Team
                    </span>
                    <input
                      type="number"
                      min="0"
                      class="px-3 py-2 rounded-md border border-grey-50 outline-none text-sm text-grey-700 focus:border-primary-500 transition-colors"
                      [ngModel]="draft.maxTeamMembers"
                      (ngModelChange)="patchDraft(plan.id, { maxTeamMembers: +$event })"
                    />
                  </label>
                </div>

                @if (!plan.isFree) {
                  <details class="group">
                    <summary
                      class="flex items-center gap-1 text-xs font-semibold text-grey-500 cursor-pointer hover:text-grey-700 list-none select-none"
                    >
                      <ui-icon
                        name="chevron-right"
                        size="12"
                        styleClass="text-grey-400 group-open:rotate-90 transition-transform"
                      />
                      Price IDs de Stripe
                    </summary>
                    <div class="flex flex-col gap-2 mt-2">
                      <input
                        type="text"
                        placeholder="price_... (mensual)"
                        class="px-3 py-2 rounded-md border border-grey-50 outline-none text-xs text-grey-700 focus:border-primary-500 transition-colors font-mono"
                        [ngModel]="draft.stripePriceIdMonthly"
                        (ngModelChange)="patchDraft(plan.id, { stripePriceIdMonthly: $event })"
                      />
                      <input
                        type="text"
                        placeholder="price_... (trimestral)"
                        class="px-3 py-2 rounded-md border border-grey-50 outline-none text-xs text-grey-700 focus:border-primary-500 transition-colors font-mono"
                        [ngModel]="draft.stripePriceIdQuarterly"
                        (ngModelChange)="patchDraft(plan.id, { stripePriceIdQuarterly: $event })"
                      />
                      <input
                        type="text"
                        placeholder="price_... (anual)"
                        class="px-3 py-2 rounded-md border border-grey-50 outline-none text-xs text-grey-700 focus:border-primary-500 transition-colors font-mono"
                        [ngModel]="draft.stripePriceIdAnnual"
                        (ngModelChange)="patchDraft(plan.id, { stripePriceIdAnnual: $event })"
                      />
                    </div>
                  </details>
                }
              </div>

              <div
                class="flex items-center justify-between gap-2 pt-3 border-t border-grey-50"
              >
                <button
                  type="button"
                  (click)="resetDraft(plan)"
                  [disabled]="!dirty || store.savingId() === plan.id"
                  class="px-3 py-2 rounded-md text-xs font-semibold text-grey-500 hover:bg-grey-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Descartar
                </button>
                <button
                  type="button"
                  (click)="save(plan)"
                  [disabled]="!dirty || store.savingId() === plan.id"
                  class="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-primary-500 text-white text-xs font-semibold hover:bg-primary-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  @if (store.savingId() === plan.id) {
                    <ui-icon
                      name="loader-circle"
                      size="12"
                      styleClass="text-white animate-spin"
                    />
                    Guardando...
                  } @else {
                    <ui-icon name="save" size="12" styleClass="text-white" />
                    Guardar
                  }
                </button>
              </div>
            </article>
          }
        </section>
      }
    </div>
  `,
})
export class Plans implements OnInit {
  protected readonly store = inject(PlansStore);

  /** Per-plan editable drafts, keyed by plan id. */
  protected readonly drafts = signal<Record<string, Draft>>({});

  protected readonly isDirty = (plan: Plan): boolean => {
    const draft = this.drafts()[plan.id];
    if (!draft) return false;
    return (
      draft.name !== plan.name ||
      (draft.description || null) !== (plan.description || null) ||
      draft.price !== plan.price ||
      draft.maxProducts !== plan.maxProducts ||
      draft.maxCatalogs !== plan.maxCatalogs ||
      draft.maxTeamMembers !== (plan.maxTeamMembers ?? 0) ||
      draft.stripePriceIdMonthly !== (plan.stripePriceIdMonthly ?? '') ||
      draft.stripePriceIdQuarterly !== (plan.stripePriceIdQuarterly ?? '') ||
      draft.stripePriceIdAnnual !== (plan.stripePriceIdAnnual ?? '')
    );
  };

  constructor() {
    // Keep drafts in sync with the canonical plan list, preserving any
    // in-flight edits that haven't been saved yet.
    effect(() => {
      const plans = this.store.plans();
      this.drafts.update((prev) => {
        const next: Record<string, Draft> = {};
        for (const plan of plans) {
          next[plan.id] = prev[plan.id] ?? toDraft(plan);
        }
        return next;
      });
    });
  }

  ngOnInit(): void {
    this.store.load();
  }

  protected patchDraft(id: string, patch: Partial<Draft>): void {
    this.drafts.update((prev) => ({
      ...prev,
      [id]: { ...prev[id], ...patch },
    }));
  }

  protected resetDraft(plan: Plan): void {
    this.drafts.update((prev) => ({ ...prev, [plan.id]: toDraft(plan) }));
  }

  protected async save(plan: Plan): Promise<void> {
    const draft = this.drafts()[plan.id];
    if (!draft) return;
    const patch: PlanUpdate = {
      name: draft.name,
      description: draft.description.trim() === '' ? null : draft.description,
      price: draft.price,
      maxProducts: draft.maxProducts,
      maxCatalogs: draft.maxCatalogs,
      maxTeamMembers: draft.maxTeamMembers,
      stripePriceIdMonthly:
        draft.stripePriceIdMonthly.trim() === '' ? null : draft.stripePriceIdMonthly,
      stripePriceIdQuarterly:
        draft.stripePriceIdQuarterly.trim() === '' ? null : draft.stripePriceIdQuarterly,
      stripePriceIdAnnual:
        draft.stripePriceIdAnnual.trim() === '' ? null : draft.stripePriceIdAnnual,
    };
    await this.store.save(plan.id, patch);
    // After save the store refreshes; drop the local draft so it picks up
    // the new canonical values.
    this.drafts.update((prev) => {
      const next = { ...prev };
      delete next[plan.id];
      return next;
    });
  }
}
