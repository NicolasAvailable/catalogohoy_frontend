import { CommonModule } from '@angular/common';
import { Component, computed, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TenantStore } from '@catalogohoy/tenant';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  ConfirmDialogComponent,
  DialogComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  SelectComponent,
  ToggleComponent,
} from '@ui';
import {
  createDefaultDiscountRule,
  DiscountRule,
  DiscountType,
  DISCOUNT_TYPE_OPTIONS,
  DISCOUNT_VALUE_TYPE_OPTIONS,
} from '../../domain';
import { DiscountService } from '../../infrastructure';

/** Value types that carry a percent/fixed amount on the rule itself. BOGO and
 *  free_shipping don't (BOGO has its own get-value, free_shipping is implicit). */
const VALUE_TYPES: DiscountType[] = [
  'code',
  'automatic',
  'order_value',
  'package',
  'first_purchase',
];

@Component({
  selector: 'lib-discounts-tab',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonComponent,
    DialogComponent,
    ConfirmDialogComponent,
    SelectComponent,
    InputTextComponent,
    InputNumberComponent,
    ToggleComponent,
  ],
  templateUrl: './discounts-tab.html',
  styleUrl: './discounts-tab.css',
})
export class DiscountsTabComponent implements OnInit {
  private readonly service = inject(DiscountService);
  private readonly tenantStore = inject(TenantStore);
  private readonly toast = inject(ToastService);

  @ViewChild('formDialog') private formDialog!: DialogComponent;
  @ViewChild(ConfirmDialogComponent) private confirmDialog!: ConfirmDialogComponent;

  public readonly typeOptions = DISCOUNT_TYPE_OPTIONS;
  public readonly valueTypeOptions = DISCOUNT_VALUE_TYPE_OPTIONS;

  public readonly rules = signal<DiscountRule[]>([]);
  public readonly isLoading = signal(false);
  public readonly tenantId = signal<string>('');

  /** The rule currently being created/edited inside the dialog. */
  public readonly draft = signal<DiscountRule | null>(null);
  public readonly isSaving = signal(false);
  private pendingDeleteId: number | null = null;

  public readonly draftType = computed<DiscountType | null>(
    () => this.draft()?.type ?? null
  );
  public readonly draftHasValue = computed(() => {
    const t = this.draftType();
    return !!t && VALUE_TYPES.includes(t);
  });

  async ngOnInit(): Promise<void> {
    const tid = await this.tenantStore.getTenantIdAsync();
    if (!tid) return;
    this.tenantId.set(String(tid));
    await this.load();
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    const res = await this.service.list(this.tenantId());
    this.isLoading.set(false);
    if (res.isRight()) this.rules.set(res.value);
  }

  typeLabel(type: DiscountType): string {
    return this.typeOptions.find((o) => o.value === type)?.label ?? type;
  }

  /** Short human description of what the rule does, for the list card. */
  summary(rule: DiscountRule): string {
    const v =
      rule.valueType === 'percent'
        ? `${rule.value}%`
        : `${rule.value}`;
    switch (rule.type) {
      case 'code':
        return `Cupón ${rule.code ?? ''} · ${v} de descuento`;
      case 'automatic':
        return `${v} en todos los pedidos`;
      case 'order_value':
        return `${v} al gastar ${rule.minOrder} o más`;
      case 'package':
        return `${v} al llevar ${rule.minItems}+ productos`;
      case 'bogo':
        return `Compra ${rule.bogoBuy?.quantity ?? 0}, lleva ${rule.bogoGet?.quantity ?? 0} con descuento`;
      case 'free_shipping':
        return rule.minOrder > 0
          ? `Envío gratis desde ${rule.minOrder}`
          : 'Envío gratis';
      case 'first_purchase':
        return `${v} en la primera compra`;
      default:
        return '';
    }
  }

  // ----------------------------------------------------------- dialog ---

  openCreate(): void {
    this.draft.set(createDefaultDiscountRule(this.rules().length));
    this.formDialog.show();
  }

  openEdit(rule: DiscountRule): void {
    // Deep-ish clone so editing the form doesn't mutate the list until save.
    this.draft.set({
      ...rule,
      bogoBuy: rule.bogoBuy ? { ...rule.bogoBuy } : null,
      bogoGet: rule.bogoGet ? { ...rule.bogoGet } : null,
    });
    this.formDialog.show();
  }

  patchDraft(patch: Partial<DiscountRule>): void {
    const current = this.draft();
    if (!current) return;
    this.draft.set({ ...current, ...patch });
  }

  onTypeChange(type: DiscountType): void {
    const current = this.draft();
    if (!current) return;
    // Seed type-specific defaults so the form is immediately valid.
    const next: DiscountRule = { ...current, type };
    if (type === 'bogo') {
      next.bogoBuy = current.bogoBuy ?? { quantity: 2 };
      next.bogoGet = current.bogoGet ?? {
        quantity: 1,
        valueType: 'percent',
        value: 100,
      };
      next.valueType = null;
    } else if (type === 'free_shipping') {
      next.valueType = null;
    } else {
      next.valueType = current.valueType ?? 'percent';
      if (!next.value) next.value = 10;
    }
    if (type !== 'code') next.code = null;
    this.draft.set(next);
  }

  patchBogoBuy(quantity: number): void {
    const d = this.draft();
    if (!d) return;
    this.draft.set({ ...d, bogoBuy: { quantity } });
  }

  patchBogoGet(patch: Partial<{ quantity: number; valueType: 'percent' | 'fixed'; value: number }>): void {
    const d = this.draft();
    if (!d) return;
    const get = d.bogoGet ?? { quantity: 1, valueType: 'percent' as const, value: 100 };
    this.draft.set({ ...d, bogoGet: { ...get, ...patch } });
  }

  get isDraftValid(): boolean {
    const d = this.draft();
    if (!d) return false;
    if (!d.name.trim()) return false;
    if (d.type === 'code' && !d.code?.trim()) return false;
    if (this.draftHasValue() && !(d.value > 0)) return false;
    if (d.type === 'bogo') {
      if (!((d.bogoBuy?.quantity ?? 0) > 0)) return false;
      if (!((d.bogoGet?.quantity ?? 0) > 0)) return false;
    }
    return true;
  }

  async save(): Promise<void> {
    const d = this.draft();
    if (!d || !this.isDraftValid || this.isSaving()) return;
    this.isSaving.set(true);
    this.toast.wait(d.id ? 'Guardando descuento...' : 'Creando descuento...');

    const res = d.id
      ? await this.service.update(d.id, d)
      : await this.service.create(this.tenantId(), d);

    this.toast.dismissWait();
    this.isSaving.set(false);

    if (res.isLeft()) {
      this.toast.warning(
        res.value.message?.includes('duplicate')
          ? 'Ya existe un cupón con ese código.'
          : 'No se pudo guardar el descuento.'
      );
      return;
    }

    this.toast.success(d.id ? 'Descuento actualizado' : 'Descuento creado');
    this.formDialog.hide();
    this.draft.set(null);
    await this.load();
  }

  async toggleActive(rule: DiscountRule): Promise<void> {
    if (rule.id === null) return;
    const next = !rule.isActive;
    // Optimistic flip.
    this.rules.set(
      this.rules().map((r) => (r.id === rule.id ? { ...r, isActive: next } : r))
    );
    const res = await this.service.setActive(rule.id, next);
    if (res.isLeft()) {
      this.toast.warning('No se pudo cambiar el estado.');
      await this.load();
    }
  }

  confirmDelete(rule: DiscountRule): void {
    if (rule.id === null) return;
    this.pendingDeleteId = rule.id;
    this.confirmDialog.warning();
  }

  async onConfirmDelete(): Promise<void> {
    const id = this.pendingDeleteId;
    if (id === null) return;
    this.toast.wait('Eliminando descuento...');
    const res = await this.service.remove(id);
    this.toast.dismissWait();
    this.pendingDeleteId = null;
    if (res.isLeft()) {
      this.toast.warning('No se pudo eliminar el descuento.');
      return;
    }
    this.toast.success('Descuento eliminado');
    await this.load();
  }

  closeDialog(): void {
    this.formDialog.hide();
    this.draft.set(null);
  }
}
