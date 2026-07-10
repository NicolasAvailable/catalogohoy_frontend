import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  SelectComponent,
} from '@ui';
import { toast } from 'ngx-sonner';
import {
  BusinessExpense,
  ExpensePeriod,
  monthlyEquivalent,
  periodLabel,
} from './business-expenses.model';
import { BusinessExpensesService } from './business-expenses.service';

@Component({
  selector: 'app-business-expenses',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    ButtonComponent,
    IconComponent,
    InputTextComponent,
    InputNumberComponent,
    SelectComponent,
  ],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0 p-1">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Gastos del negocio</h1>
        <p class="text-sm text-grey-400">
          Servicios y suscripciones que paga la empresa. Agregá cada servicio
          con su precio y período para ver el costo total.
        </p>
      </header>

      <section class="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-primary-50"
          >
            <ui-icon name="wallet" size="18" styleClass="text-primary-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Total mensual</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ monthlyTotal() | number: '1.2-2' }} USD
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-amber-50"
          >
            <ui-icon
              name="calendar-days"
              size="18"
              styleClass="text-amber-500"
            />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Total anual</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ yearlyTotal() | number: '1.2-2' }} USD
            </strong>
          </div>
        </article>
        <article
          class="flex items-center gap-3 p-4 bg-white rounded-xl border border-grey-50"
        >
          <div
            class="flex items-center justify-center w-10 h-10 rounded-lg bg-emerald-50"
          >
            <ui-icon name="list" size="18" styleClass="text-emerald-500" />
          </div>
          <div class="flex flex-col">
            <span class="text-xs text-grey-400">Servicios</span>
            <strong class="text-xl font-bold text-grey-700">
              {{ expenses().length }}
            </strong>
          </div>
        </article>
      </section>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 min-h-0">
        <!-- Form -->
        <div
          class="lg:col-span-2 bg-white border border-grey-100 rounded-xl p-5 flex flex-col gap-4 h-fit"
        >
          <h2 class="text-lg font-bold text-grey-700">
            {{ editingId() === null ? 'Nuevo servicio' : 'Editar servicio' }}
          </h2>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-grey-500">Servicio</label>
            <ui-input-text [(ngModel)]="name" placeholder="Supabase" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-grey-500">Empresa</label>
            <ui-input-text [(ngModel)]="company" placeholder="Supabase Inc." />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-grey-500">
                Precio (USD)
              </label>
              <ui-input-number
                [(ngModel)]="amountUsd"
                [showButtons]="false"
                [min]="0"
                placeholder="25"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-grey-500">Período</label>
              <ui-select
                [options]="periodOptions"
                [(ngModel)]="period"
                optionLabel="label"
                optionValue="value"
              />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <ui-button
              [label]="editingId() === null ? 'Agregar servicio' : 'Guardar cambios'"
              [icon]="editingId() === null ? 'plus' : 'save'"
              [disabled]="!canSubmit() || isSaving()"
              [isLoading]="isSaving()"
              (click)="save()"
            />
            @if (editingId() !== null) {
              <ui-button
                label="Cancelar edición"
                variant="outlined"
                severity="contrast"
                (click)="cancelEdit()"
              />
            }
          </div>
        </div>

        <!-- List -->
        <div
          class="lg:col-span-3 bg-white border border-grey-100 rounded-xl flex flex-col min-h-0 overflow-hidden"
        >
          <div
            class="flex items-center justify-between p-4 border-b border-grey-50"
          >
            <h2 class="text-lg font-bold text-grey-700">Servicios actuales</h2>
            <ui-button
              label="Refrescar"
              icon="refresh-cw"
              variant="outlined"
              severity="contrast"
              size="small"
              [fluid]="false"
              (click)="load()"
            />
          </div>

          <div class="overflow-auto flex-1">
            @if (isLoading()) {
              <p class="text-sm text-grey-400 p-4">Cargando…</p>
            } @else if (expenses().length === 0) {
              <p class="text-sm text-grey-400 p-4">
                Todavía no hay servicios cargados.
              </p>
            } @else {
              <table class="w-full text-left text-sm">
                <thead
                  class="sticky top-0 bg-grey-25 text-grey-400 text-xs uppercase"
                >
                  <tr>
                    <th class="px-4 py-2 font-bold">Servicio</th>
                    <th class="px-4 py-2 font-bold text-right">Precio</th>
                    <th class="px-4 py-2 font-bold text-center">Período</th>
                    <th class="px-4 py-2 font-bold text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (e of expenses(); track e.id) {
                    <tr class="border-b border-grey-50">
                      <td class="px-4 py-2.5">
                        <div class="flex flex-col">
                          <strong class="font-bold text-grey-800">
                            {{ e.name }}
                          </strong>
                          <span class="text-xs text-grey-400">
                            {{ e.company }}
                          </span>
                        </div>
                      </td>
                      <td class="px-4 py-2.5 text-right text-grey-700">
                        <div class="flex flex-col items-end">
                          <span class="font-semibold">
                            {{ e.amountUsd | number: '1.2-2' }} USD
                          </span>
                          @if (e.period === 'yearly') {
                            <span class="text-xs text-grey-400">
                              ≈ {{ monthlyEquivalent(e) | number: '1.2-2' }}
                              USD/mes
                            </span>
                          }
                        </div>
                      </td>
                      <td class="px-4 py-2.5 text-center">
                        <span
                          [class]="
                            'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ' +
                            (e.period === 'yearly'
                              ? 'bg-amber-50 text-amber-600'
                              : 'bg-primary-50 text-primary-600')
                          "
                        >
                          {{ periodLabel(e.period) }}
                        </span>
                      </td>
                      <td class="px-4 py-2.5 text-right">
                        <div class="inline-flex items-center gap-2">
                          <button
                            type="button"
                            (click)="startEdit(e)"
                            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-primary-50 text-primary-600 hover:bg-primary-100 transition-colors cursor-pointer text-xs font-semibold"
                          >
                            <ui-icon name="pencil" size="12" />
                            Editar
                          </button>
                          <button
                            type="button"
                            (click)="requestDelete(e)"
                            [disabled]="deletingId() === e.id"
                            class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md transition-colors cursor-pointer text-xs font-semibold disabled:opacity-50"
                            [class.bg-red-50]="deleteArmedId() !== e.id"
                            [class.text-red-500]="deleteArmedId() !== e.id"
                            [class.hover:bg-red-100]="deleteArmedId() !== e.id"
                            [class.bg-red-500]="deleteArmedId() === e.id"
                            [class.text-white]="deleteArmedId() === e.id"
                          >
                            <ui-icon name="trash" size="12" />
                            {{
                              deleteArmedId() === e.id
                                ? '¿Eliminar?'
                                : 'Eliminar'
                            }}
                          </button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class BusinessExpenses implements OnInit {
  private readonly service = inject(BusinessExpensesService);

  protected readonly expenses = signal<BusinessExpense[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly deletingId = signal<number | null>(null);
  protected readonly deleteArmedId = signal<number | null>(null);
  private disarmTimeout: ReturnType<typeof setTimeout> | null = null;

  protected readonly editingId = signal<number | null>(null);
  protected readonly name = signal('');
  protected readonly company = signal('');
  protected readonly amountUsd = signal<number | null>(null);
  protected readonly period = signal<ExpensePeriod>('monthly');

  protected readonly periodOptions = [
    { label: 'Mensual', value: 'monthly' },
    { label: 'Anual', value: 'yearly' },
  ];

  protected readonly monthlyTotal = computed(() =>
    this.expenses().reduce((sum, e) => sum + monthlyEquivalent(e), 0)
  );

  protected readonly yearlyTotal = computed(() =>
    this.expenses().reduce(
      (sum, e) =>
        sum + (e.period === 'yearly' ? e.amountUsd : e.amountUsd * 12),
      0
    )
  );

  protected readonly canSubmit = computed(
    () =>
      this.name().trim().length > 0 &&
      this.company().trim().length > 0 &&
      this.amountUsd() !== null &&
      (this.amountUsd() ?? 0) >= 0
  );

  ngOnInit(): void {
    this.load();
  }

  protected async load(): Promise<void> {
    this.isLoading.set(true);
    const result = await this.service.list();
    this.isLoading.set(false);
    result.fold(
      (err) => {
        toast.error(`No se pudieron cargar los gastos: ${err.message}`);
      },
      (expenses) => {
        this.expenses.set(expenses);
      }
    );
  }

  protected async save(): Promise<void> {
    if (!this.canSubmit() || this.isSaving()) return;
    this.isSaving.set(true);
    const result = await this.service.save({
      id: this.editingId(),
      name: this.name().trim(),
      company: this.company().trim(),
      amountUsd: this.amountUsd() ?? 0,
      period: this.period(),
    });
    this.isSaving.set(false);
    result.fold(
      (err) => {
        toast.error(`No se pudo guardar: ${err.message}`);
      },
      () => {
        toast.success(
          this.editingId() === null
            ? 'Servicio agregado'
            : 'Servicio actualizado'
        );
        this.resetForm();
        this.load();
      }
    );
  }

  protected startEdit(expense: BusinessExpense): void {
    this.editingId.set(expense.id);
    this.name.set(expense.name);
    this.company.set(expense.company);
    this.amountUsd.set(expense.amountUsd);
    this.period.set(expense.period);
  }

  protected cancelEdit(): void {
    this.resetForm();
  }

  protected async requestDelete(expense: BusinessExpense): Promise<void> {
    // Primer click arma la confirmación (el botón pregunta "¿Eliminar?");
    // el segundo dentro de los 3s borra de verdad.
    if (this.deleteArmedId() !== expense.id) {
      this.deleteArmedId.set(expense.id);
      if (this.disarmTimeout) clearTimeout(this.disarmTimeout);
      this.disarmTimeout = setTimeout(
        () => this.deleteArmedId.set(null),
        3000
      );
      return;
    }

    if (this.disarmTimeout) clearTimeout(this.disarmTimeout);
    this.deleteArmedId.set(null);
    this.deletingId.set(expense.id);
    const result = await this.service.remove(expense.id);
    this.deletingId.set(null);
    result.fold(
      (err) => {
        toast.error(`No se pudo eliminar: ${err.message}`);
      },
      () => {
        toast.success('Servicio eliminado');
        if (this.editingId() === expense.id) this.resetForm();
        this.load();
      }
    );
  }

  private resetForm(): void {
    this.editingId.set(null);
    this.name.set('');
    this.company.set('');
    this.amountUsd.set(null);
    this.period.set('monthly');
  }

  protected periodLabel = periodLabel;
  protected monthlyEquivalent = monthlyEquivalent;
}
