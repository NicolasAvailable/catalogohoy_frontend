import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, DialogService, dialogConfig, IconComponent } from '@ui';
import { DynamicDialogConfig, DynamicDialogRef } from 'primeng/dynamicdialog';
import {
  BASE_EXPENSE_STATUS_META,
  EXPENSE_STAGE_COLORS,
  ExpenseStatusDef,
} from '../../../domain';
import { ExpenseStageStore } from '../../../infrastructure';

type DraftItem = ExpenseStatusDef & { uid: string };

/** Abre el editor de estados de gastos. Con `quickCreate` arranca con un
 *  estado nuevo y al guardar devuelve su `ExpenseStatusDef`. */
export function openExpenseStagesEditor(dialogService: DialogService, quickCreate = false) {
  return dialogService.open(
    ExpenseStagesModal,
    dialogConfig({
      data: { quickCreate },
      showHeader: false,
      style: { width: '52rem', maxWidth: '95vw' },
      contentStyle: { padding: '0' },
    })
  );
}

/** Editor de los estados de Gastos y facturas: renombrar, color y ordenar los
 *  base; crear, configurar (pagada o por pagar), ocultar y borrar los propios.
 *  Todo queda en un borrador local y se guarda junto. */
@Component({
  selector: 'lib-expense-stages-modal',
  standalone: true,
  imports: [FormsModule, DragDropModule, TranslocoPipe, IconComponent, ButtonComponent],
  templateUrl: './expense-stages-modal.html',
})
export class ExpenseStagesModal {
  private readonly ref = inject(DynamicDialogRef);
  public readonly quickCreate = !!inject(DynamicDialogConfig).data?.quickCreate;
  private readonly toast = inject(ToastService);
  private readonly stageStore = inject(ExpenseStageStore);

  public readonly colors = EXPENSE_STAGE_COLORS;
  public readonly items = signal<DraftItem[]>([]);
  public readonly selectedUid = signal<string | null>(null);
  public readonly deletedIds = signal<string[]>([]);
  public readonly isSaving = signal(false);
  public readonly confirmingDelete = signal(false);
  /** Gastos que hay hoy en el estado propio seleccionado. */
  public readonly countInSelected = signal(0);
  private seq = 0;

  public readonly selected = computed(
    () => this.items().find((i) => i.uid === this.selectedUid()) ?? null
  );
  /** Los base tienen comportamiento fijo; los propios con gastos también. */
  public readonly behaviorLocked = computed(() => {
    const s = this.selected();
    return !!s && (s.system || (!!s.rowId && this.countInSelected() > 0));
  });

  constructor() {
    this.init();
  }

  private async init() {
    await this.stageStore.load(true);
    this.items.set(this.stageStore.defs().map((d) => ({ ...d, uid: d.key })));
    if (this.quickCreate) {
      this.addStatus();
    } else if (window.matchMedia('(min-width: 768px)').matches) {
      this.select(this.items()[0]?.uid ?? null);
    }
  }

  baseName(item: ExpenseStatusDef): string {
    return BASE_EXPENSE_STATUS_META[item.baseStatus].label;
  }

  async select(uid: string | null) {
    this.confirmingDelete.set(false);
    this.countInSelected.set(0);
    this.selectedUid.set(uid);
    const item = this.items().find((i) => i.uid === uid);
    if (item && !item.system && item.rowId) {
      const count = await this.stageStore.countExpenses(item.rowId);
      if (this.selectedUid() === uid) this.countInSelected.set(count);
    }
  }

  addStatus() {
    const used = new Set(this.items().map((i) => i.color));
    const uid = `new-${++this.seq}`;
    const item: DraftItem = {
      uid,
      key: `stage:${uid}`,
      label: '',
      color: this.colors.find((c) => !used.has(c)) ?? this.colors[4],
      baseStatus: 'pending',
      system: false,
      hidden: false,
      position: 0,
      rowId: null,
    };
    // Antes de "Pagada" si sigue ahí; si no, al final.
    const list = [...this.items()];
    const idx = list.findIndex((i) => i.system && i.baseStatus === 'paid');
    list.splice(idx === -1 ? list.length : idx, 0, item);
    this.items.set(list);
    this.select(uid);
  }

  patch(patch: Partial<DraftItem>) {
    const uid = this.selectedUid();
    this.items.update((list) => list.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  }

  setPaid(paid: boolean) {
    if (this.behaviorLocked()) return;
    this.patch({ baseStatus: paid ? 'paid' : 'pending' });
  }

  toggleHidden(item: DraftItem) {
    if (item.system) return;
    this.items.update((list) =>
      list.map((i) => (i.uid === item.uid ? { ...i, hidden: !i.hidden } : i))
    );
  }

  drop(event: CdkDragDrop<DraftItem[]>) {
    if (event.previousIndex === event.currentIndex) return;
    const list = [...this.items()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    this.items.set(list);
  }

  removeSelected() {
    const item = this.selected();
    if (!item || item.system) return;
    if (item.rowId) this.deletedIds.update((ids) => [...ids, item.rowId as string]);
    this.items.update((list) => list.filter((i) => i.uid !== item.uid));
    this.select(null);
  }

  async save() {
    if (this.isSaving()) return;
    const items = this.items().map((i) => ({ ...i, label: i.label.trim() }));
    const empty = items.find((i) => !i.label);
    if (empty) {
      this.select(empty.uid);
      this.toast.error(new Exception('Ponle un nombre al estado'));
      return;
    }
    const names = new Set<string>();
    for (const i of items) {
      const name = i.label.toLowerCase();
      if (names.has(name)) {
        this.select(i.uid);
        this.toast.error(new Exception('Ya tienes un estado con ese nombre'));
        return;
      }
      names.add(name);
    }
    this.isSaving.set(true);
    const result = await this.stageStore.saveAll(items, this.deletedIds());
    this.isSaving.set(false);
    result.fold(
      (error) => this.toast.error(new Exception(error)),
      () => {
        this.toast.success('Estados guardados');
        this.ref.close(this.quickCreate ? this.createdDef(items) : undefined);
      }
    );
  }

  /** El estado creado en modo rápido, ya con su id (lo busca por nombre). */
  private createdDef(items: DraftItem[]): ExpenseStatusDef | undefined {
    const draft = items.find((i) => !i.system && !i.rowId);
    if (!draft) return undefined;
    return this.stageStore
      .defs()
      .find((d) => !d.system && d.label.toLowerCase() === draft.label.toLowerCase());
  }

  close() {
    this.ref.close();
  }
}
