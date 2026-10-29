import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, IconComponent } from '@ui';
import { DynamicDialogRef } from 'primeng/dynamicdialog';
import { OrderStatus } from '../../../domain/order';
import {
  BASE_STATUS_BEHAVIOR,
  BASE_STATUS_META,
  ORDER_STAGE_COLORS,
  OrderStage,
} from '../../../domain/order-stage';
import { OrderStageStore } from '../../../infrastructure/order-stage.store';

type Draft = {
  /** null = estado nuevo. */
  id: string | null;
  label: string;
  color: string;
  baseStatus: OrderStatus;
};

/** Editor de los estados de orden propios de la tienda: crear, renombrar,
 *  color, comportamiento (stock/ventas), orden y borrar. Se abre desde el
 *  botón "Estados" del listado de órdenes. */
@Component({
  selector: 'lib-order-stages-modal',
  standalone: true,
  imports: [FormsModule, NgTemplateOutlet, TranslocoPipe, IconComponent, ButtonComponent],
  templateUrl: './order-stages-modal.html',
})
export class OrderStagesModal {
  private readonly ref = inject(DynamicDialogRef);
  private readonly toast = inject(ToastService);
  public readonly stageStore = inject(OrderStageStore);

  public readonly colors = ORDER_STAGE_COLORS;
  public readonly behaviors = BASE_STATUS_BEHAVIOR;
  public readonly baseStatuses = (Object.keys(BASE_STATUS_META) as OrderStatus[]).map(
    (status) => ({ status, ...BASE_STATUS_META[status] })
  );

  public readonly stages = computed(() =>
    [...this.stageStore.stages()].sort((a, b) => a.position - b.position)
  );

  public readonly draft = signal<Draft | null>(null);
  public readonly isSaving = signal(false);
  /** Estado con el "¿Seguro?" de borrar abierto. */
  public readonly confirmingDelete = signal<string | null>(null);
  /** Órdenes que hay hoy en el estado que se está editando/borrando. */
  public readonly ordersInStage = signal(0);

  constructor() {
    this.stageStore.load(true);
  }

  behaviorHint(status: OrderStatus): string {
    return this.behaviors.find((b) => b.value === status)?.hint ?? '';
  }

  baseName(status: OrderStatus): string {
    return BASE_STATUS_META[status].label;
  }

  behaviorLabel(status: OrderStatus): string {
    return this.behaviors.find((b) => b.value === status)?.label ?? status;
  }

  newStage() {
    this.confirmingDelete.set(null);
    this.ordersInStage.set(0);
    const used = new Set(this.stageStore.stages().map((s) => s.color));
    this.draft.set({
      id: null,
      label: '',
      color: this.colors.find((c) => !used.has(c)) ?? this.colors[0],
      baseStatus: 'pending',
    });
  }

  async editStage(stage: OrderStage) {
    this.confirmingDelete.set(null);
    this.draft.set({
      id: stage.id,
      label: stage.label,
      color: stage.color,
      baseStatus: stage.baseStatus,
    });
    this.ordersInStage.set(await this.stageStore.countOrders(stage.id));
  }

  patchDraft(patch: Partial<Draft>) {
    const d = this.draft();
    if (d) this.draft.set({ ...d, ...patch });
  }

  /** Con órdenes adentro no se cambia el comportamiento: esas órdenes ya
   *  descontaron (o no) stock con el comportamiento anterior. */
  isBehaviorLocked(): boolean {
    const d = this.draft();
    return !!d?.id && this.ordersInStage() > 0;
  }

  cancelDraft() {
    this.draft.set(null);
  }

  async saveDraft() {
    const d = this.draft();
    if (!d || this.isSaving()) return;
    const label = d.label.trim();
    if (!label) {
      this.toast.error(new Exception('Ponle un nombre al estado'));
      return;
    }
    const taken = [
      ...this.baseStatuses.map((b) => b.label),
      ...this.stageStore.stages().filter((s) => s.id !== d.id).map((s) => s.label),
    ].some((l) => l.trim().toLowerCase() === label.toLowerCase());
    if (taken) {
      this.toast.error(new Exception('Ya tienes un estado con ese nombre'));
      return;
    }

    this.isSaving.set(true);
    const input = { label, color: d.color, baseStatus: d.baseStatus };
    const result = d.id
      ? await this.stageStore.update(d.id, input)
      : await this.stageStore.create(input);
    this.isSaving.set(false);
    result.fold(
      (error) => this.toast.error(new Exception(error)),
      () => {
        this.toast.success(d.id ? 'Estado actualizado' : 'Estado creado');
        this.draft.set(null);
      }
    );
  }

  async move(stage: OrderStage, direction: -1 | 1) {
    const result = await this.stageStore.move(stage.id, direction);
    result.mapLeft((error) => this.toast.error(new Exception(error)));
  }

  async askDelete(stage: OrderStage) {
    this.draft.set(null);
    this.confirmingDelete.set(stage.id);
    this.ordersInStage.set(await this.stageStore.countOrders(stage.id));
  }

  async confirmDelete(stage: OrderStage) {
    if (this.isSaving()) return;
    this.isSaving.set(true);
    const result = await this.stageStore.remove(stage.id);
    this.isSaving.set(false);
    result.fold(
      (error) => this.toast.error(new Exception(error)),
      () => {
        this.toast.success('Estado eliminado');
        this.confirmingDelete.set(null);
      }
    );
  }

  close() {
    this.ref.close();
  }
}
