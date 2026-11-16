import {
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { PlanStore } from '@catalogohoy/plan';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, IconComponent, TooltipDirective } from '@ui';
import {
  BULK_COLUMNS,
  BulkCellValue,
  BulkColumn,
  BulkColumnKey,
  BulkEdits,
  BulkRow,
  BulkRowValues,
  buildBulkPatches,
  buildBulkRows,
  normalizeSearch,
  parseBulkBool,
  parseTsv,
  Product,
  sameBulkValue,
  toTsv,
  validateBulkCell,
} from '../../../domain';
import { ProductService, ProductStore } from '../../../infrastructure';

interface CellPos {
  r: number;
  c: number;
}
interface CellRange {
  r1: number;
  r2: number;
  c1: number;
  c2: number;
}
interface EditingState {
  r: number;
  c: number;
  value: string;
  /** 'enter' = se empezó tecleando (las flechas confirman y mueven, como en
   *  Excel); 'edit' = doble clic / F2 / Enter (las flechas mueven el cursor). */
  mode: 'enter' | 'edit';
}
/** Un cambio de celda para deshacer/rehacer. `undefined` = sin edición. */
interface UndoEntry {
  rowKey: string;
  col: BulkColumnKey;
  before: BulkCellValue | undefined;
  after: BulkCellValue | undefined;
}
interface CellChange {
  row: BulkRow;
  col: BulkColumnKey;
  value: BulkCellValue;
}

/** Alto fijo de fila (px). La grilla dibuja solo las filas visibles, así que
 *  debe coincidir con el CSS (`.bulk-row`). */
const ROW_H = 34;
const HEADER_H = 40;
const ROWNUM_W = 56;
const OVERSCAN = 8;
const MAX_UNDO = 100;

/**
 * Edición masiva de productos estilo hoja de cálculo (CAT-76, pedido de
 * Distribuidora Moto Fox). Selección de rangos con mouse/teclado, copiar y
 * pegar desde/hacia Excel o Google Sheets, rellenar arrastrando, deshacer, y
 * guardado en bloque de las filas modificadas.
 */
@Component({
  selector: 'lib-bulk-edit',
  imports: [FormsModule, TranslocoPipe, ButtonComponent, IconComponent, TooltipDirective],
  templateUrl: './bulk-edit.html',
  styleUrl: './bulk-edit.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export default class BulkEdit implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly productService = inject(ProductService);
  private readonly productStore = inject(ProductStore);
  private readonly toastService = inject(ToastService);
  private readonly permissions = inject(TeamPermissionsStore);
  private readonly planStore = inject(PlanStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);

  protected readonly cols = BULK_COLUMNS;
  protected readonly ROW_H = ROW_H;
  protected readonly HEADER_H = HEADER_H;
  protected readonly ROWNUM_W = ROWNUM_W;
  protected readonly totalWidth = ROWNUM_W + BULK_COLUMNS.reduce((a, c) => a + c.width, 0);
  /** Borde izquierdo de cada columna (px), contando la columna de números. */
  private readonly colLeft = BULK_COLUMNS.reduce<number[]>(
    (acc, c, i) => [...acc, i === 0 ? ROWNUM_W : acc[i - 1] + BULK_COLUMNS[i - 1].width],
    []
  );
  /** Ancho que tapan las columnas fijas (números + nombre). */
  private readonly stickyWidth = ROWNUM_W + BULK_COLUMNS[0].width;

  /** Mismo criterio que el listado: en Venezuela los precios se guardan en USD. */
  protected readonly cs = computed(() =>
    this.tenantCurrency.isVenezuela() ? '$' : this.tenantCurrency.localSymbol() || '$'
  );

  protected readonly canEdit = computed(
    () => this.permissions.isOwner() || this.permissions.can()('productos', 'edit')
  );

  protected readonly isLoading = signal(true);
  protected readonly isSaving = signal(false);
  private readonly products = signal<Product[]>([]);
  private readonly allRows = signal<BulkRow[]>([]);
  protected readonly edits = signal<BulkEdits>(new Map());
  /** Productos que fallaron al guardar → mensaje. */
  protected readonly saveErrors = signal<Map<string, string>>(new Map());

  protected readonly search = signal('');
  protected readonly onlyModified = signal(false);

  /** Productos bloqueados por el límite del plan gratis (mismo cálculo que el
   *  listado): no se pueden editar hasta mejorar el plan. */
  private readonly lockedIds = computed(() => {
    const locked = new Set<string>();
    if (!this.planStore.isFreePlan()) return locked;
    const cap = this.planStore.maxProducts();
    if (cap <= 0) return locked;
    let rank = 0;
    for (const p of this.products()) {
      if (p.isHidden) continue;
      if (rank >= cap) locked.add(String(p.id));
      rank++;
    }
    return locked;
  });

  /** Filas visibles según búsqueda / "solo modificadas". */
  protected readonly rows = computed(() => {
    let rows = this.allRows();
    const term = normalizeSearch(this.search().trim());
    if (term) {
      const words = term.split(/\s+/);
      rows = rows.filter((r) => words.every((w) => r.searchText.includes(w)));
    }
    if (this.onlyModified()) {
      const edits = this.edits();
      const failed = this.saveErrors();
      rows = rows.filter((r) => edits.has(r.key) || failed.has(r.productId));
    }
    return rows;
  });

  protected readonly modifiedRowCount = computed(() => this.edits().size);
  protected readonly modifiedProductCount = computed(() => {
    const ids = new Set<string>();
    const byKey = this.rowByKey();
    for (const key of this.edits().keys()) {
      const row = byKey.get(key);
      if (row) ids.add(row.productId);
    }
    return ids.size;
  });

  private readonly rowByKey = computed(
    () => new Map(this.allRows().map((r) => [r.key, r] as const))
  );

  /** rowKey → columna → mensaje de error. */
  protected readonly errors = computed(() => {
    const out = new Map<string, Partial<Record<BulkColumnKey, string>>>();
    const byKey = this.rowByKey();
    for (const [key, values] of this.edits()) {
      const row = byKey.get(key);
      if (!row) continue;
      for (const col of Object.keys(values) as BulkColumnKey[]) {
        const msg = validateBulkCell(row, col, values[col] as BulkCellValue);
        if (msg) out.set(key, { ...(out.get(key) ?? {}), [col]: msg });
      }
    }
    return out;
  });
  protected readonly errorCount = computed(() => {
    let n = 0;
    for (const v of this.errors().values()) n += Object.keys(v).length;
    return n;
  });

  // ── Selección ──────────────────────────────────────────────────────────
  /** Celda activa (donde se escribe). */
  protected readonly cursor = signal<CellPos>({ r: 0, c: 0 });
  /** Otra esquina del rango seleccionado. */
  protected readonly extent = signal<CellPos>({ r: 0, c: 0 });
  protected readonly range = computed<CellRange>(() => {
    const a = this.cursor();
    const b = this.extent();
    return {
      r1: Math.min(a.r, b.r),
      r2: Math.max(a.r, b.r),
      c1: Math.min(a.c, b.c),
      c2: Math.max(a.c, b.c),
    };
  });
  protected readonly selectionSize = computed(() => {
    const g = this.range();
    return (g.r2 - g.r1 + 1) * (g.c2 - g.c1 + 1);
  });
  protected readonly editing = signal<EditingState | null>(null);
  /** Vista previa al arrastrar el cuadrito de rellenar. */
  protected readonly fillTarget = signal<CellRange | null>(null);

  private dragMode: 'cells' | 'rows' | 'cols' | 'fill' | null = null;
  private undoStack: UndoEntry[][] = [];
  private redoStack: UndoEntry[][] = [];

  // ── Ventana visible (solo se dibujan las filas en pantalla) ──────────────
  protected readonly scrollTop = signal(0);
  private readonly viewportH = signal(600);
  protected readonly windowStart = computed(() =>
    Math.max(0, Math.floor(this.scrollTop() / ROW_H) - OVERSCAN)
  );
  protected readonly windowEnd = computed(() =>
    Math.min(
      this.rows().length,
      Math.ceil((this.scrollTop() + this.viewportH()) / ROW_H) + OVERSCAN
    )
  );
  protected readonly visibleRows = computed(() =>
    this.rows()
      .slice(this.windowStart(), this.windowEnd())
      .map((row, i) => ({ row, index: this.windowStart() + i }))
  );

  private readonly scroller = viewChild<ElementRef<HTMLDivElement>>('scroller');
  private readonly editor = viewChild<ElementRef<HTMLInputElement>>('editor');
  private resizeObserver?: ResizeObserver;

  constructor() {
    // Al abrir el editor de una celda: foco + cursor al final (o todo
    // seleccionado si se entró con doble clic/F2, como Google Sheets).
    effect(() => {
      const el = this.editor()?.nativeElement;
      const editing = this.editing();
      if (!el || !editing) return;
      queueMicrotask(() => {
        el.focus();
        const len = el.value.length;
        el.setSelectionRange(len, len);
      });
    });

    // Medir el alto disponible para saber cuántas filas dibujar.
    effect(() => {
      const el = this.scroller()?.nativeElement;
      if (!el || this.resizeObserver) return;
      this.viewportH.set(el.clientHeight);
      this.resizeObserver = new ResizeObserver(() => this.viewportH.set(el.clientHeight));
      this.resizeObserver.observe(el);
    });
  }

  ngOnInit(): void {
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) this.tenantCurrency.load(tid);
    });
    this.planStore.loadTenantPlanUsage();
    this.load();
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.stopAutoScroll();
  }

  private async load(): Promise<void> {
    this.isLoading.set(true);
    const result = await this.productService.getAll();
    result
      .mapRight((list) => {
        this.products.set(list.products);
        const rows = buildBulkRows(list.products);
        this.allRows.set(rows);
        // Conserva ediciones pendientes (p. ej. productos que fallaron) si la
        // fila sigue existiendo y la celda sigue aplicando.
        const byKey = new Map(rows.map((r) => [r.key, r] as const));
        const kept: BulkEdits = new Map();
        for (const [key, values] of this.edits()) {
          const row = byKey.get(key);
          if (!row) continue;
          const v: BulkRowValues = {};
          for (const col of Object.keys(values) as BulkColumnKey[]) {
            if (col in row.original && !this.sameAsOriginal(row, col, values[col])) {
              v[col] = values[col];
            }
          }
          if (Object.keys(v).length) kept.set(key, v);
        }
        this.edits.set(kept);
      })
      .mapLeft((err) => this.toastService.error(new Exception(err.message)));
    this.isLoading.set(false);
  }

  // ── Valores ────────────────────────────────────────────────────────────
  private colType(col: BulkColumnKey) {
    return BULK_COLUMNS.find((c) => c.key === col)?.type ?? 'text';
  }

  private sameAsOriginal(row: BulkRow, col: BulkColumnKey, value: BulkCellValue | undefined) {
    return sameBulkValue(this.colType(col), row.original[col], value);
  }

  protected value(row: BulkRow, col: BulkColumnKey): BulkCellValue | undefined {
    const e = this.edits().get(row.key);
    return e && col in e ? e[col] : row.original[col];
  }

  protected display(row: BulkRow, col: BulkColumn): string {
    const v = this.value(row, col.key);
    if (v === undefined) return '';
    if (typeof v === 'boolean') return v ? 'Sí' : 'No';
    return v;
  }

  protected isLocked(row: BulkRow): boolean {
    return this.lockedIds().has(row.productId);
  }

  /** La celda existe para esta fila (p. ej. "Precio promocional" no existe en
   *  una variante). */
  protected applies(row: BulkRow, col: BulkColumnKey): boolean {
    return col in row.original;
  }

  protected editable(row: BulkRow, col: BulkColumnKey): boolean {
    return this.canEdit() && this.applies(row, col) && !this.isLocked(row);
  }

  protected isDirty(row: BulkRow, col: BulkColumnKey): boolean {
    const e = this.edits().get(row.key);
    return !!e && col in e;
  }

  protected cellError(row: BulkRow, col: BulkColumnKey): string | null {
    return this.errors().get(row.key)?.[col] ?? null;
  }

  protected rowSaveError(row: BulkRow): string | null {
    return this.saveErrors().get(row.productId) ?? null;
  }

  protected isRowDirty(row: BulkRow): boolean {
    return this.edits().has(row.key);
  }

  /** Aplica cambios de celdas (ignorando las que no se pueden editar) y los
   *  registra para deshacer. Devuelve cuántas celdas cambiaron. */
  private setCells(changes: CellChange[]): number {
    const next: BulkEdits = new Map(this.edits());
    const batch: UndoEntry[] = [];
    for (const { row, col, value } of changes) {
      if (!this.editable(row, col)) continue;
      const current = next.get(row.key);
      const before = current && col in current ? current[col] : undefined;
      const after = this.sameAsOriginal(row, col, value) ? undefined : value;
      if (before === after) continue;
      this.writeEdit(next, row.key, col, after);
      batch.push({ rowKey: row.key, col, before, after });
    }
    if (!batch.length) return 0;
    this.edits.set(next);
    this.undoStack.push(batch);
    if (this.undoStack.length > MAX_UNDO) this.undoStack.shift();
    this.redoStack = [];
    return batch.length;
  }

  private writeEdit(
    map: BulkEdits,
    rowKey: string,
    col: BulkColumnKey,
    value: BulkCellValue | undefined
  ) {
    const values = { ...(map.get(rowKey) ?? {}) };
    if (value === undefined) delete values[col];
    else values[col] = value;
    if (Object.keys(values).length) map.set(rowKey, values);
    else map.delete(rowKey);
  }

  protected undo(): void {
    const batch = this.undoStack.pop();
    if (!batch) return;
    const next: BulkEdits = new Map(this.edits());
    for (const e of [...batch].reverse()) this.writeEdit(next, e.rowKey, e.col, e.before);
    this.edits.set(next);
    this.redoStack.push(batch);
  }

  protected redo(): void {
    const batch = this.redoStack.pop();
    if (!batch) return;
    const next: BulkEdits = new Map(this.edits());
    for (const e of batch) this.writeEdit(next, e.rowKey, e.col, e.after);
    this.edits.set(next);
    this.undoStack.push(batch);
  }

  // ── Selección: helpers de plantilla ──────────────────────────────────────
  protected inRange(r: number, c: number): boolean {
    const g = this.range();
    return r >= g.r1 && r <= g.r2 && c >= g.c1 && c <= g.c2;
  }

  protected isCursor(r: number, c: number): boolean {
    const p = this.cursor();
    return p.r === r && p.c === c;
  }

  protected inFill(r: number, c: number): boolean {
    const f = this.fillTarget();
    return !!f && r >= f.r1 && r <= f.r2 && c >= f.c1 && c <= f.c2;
  }

  protected isFillHandle(r: number, c: number): boolean {
    const g = this.range();
    return this.canEdit() && !this.editing() && r === g.r2 && c === g.c2;
  }

  protected isEditing(r: number, c: number): boolean {
    const e = this.editing();
    return !!e && e.r === r && e.c === c;
  }

  protected colSelected(c: number): boolean {
    const g = this.range();
    return c >= g.c1 && c <= g.c2;
  }

  protected rowSelected(r: number): boolean {
    const g = this.range();
    return r >= g.r1 && r <= g.r2;
  }

  private clampPos(p: CellPos): CellPos {
    const maxR = Math.max(0, this.rows().length - 1);
    const maxC = BULK_COLUMNS.length - 1;
    return { r: Math.min(maxR, Math.max(0, p.r)), c: Math.min(maxC, Math.max(0, p.c)) };
  }

  private select(cursor: CellPos, extent: CellPos = cursor, scrollTo: CellPos = extent): void {
    this.cursor.set(this.clampPos(cursor));
    this.extent.set(this.clampPos(extent));
    this.ensureVisible(this.clampPos(scrollTo));
  }

  private ensureVisible(p: CellPos): void {
    const el = this.scroller()?.nativeElement;
    if (!el) return;
    const top = p.r * ROW_H;
    const bodyH = el.clientHeight - HEADER_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_H > el.scrollTop + bodyH) el.scrollTop = top + ROW_H - bodyH;

    if (p.c > 0) {
      const left = this.colLeft[p.c];
      const right = left + BULK_COLUMNS[p.c].width;
      if (left < el.scrollLeft + this.stickyWidth) el.scrollLeft = left - this.stickyWidth;
      else if (right > el.scrollLeft + el.clientWidth) el.scrollLeft = right - el.clientWidth;
    }
  }

  protected onScroll(event: Event): void {
    this.scrollTop.set((event.target as HTMLElement).scrollTop);
  }

  private focusGrid(): void {
    this.scroller()?.nativeElement.focus({ preventScroll: true });
  }

  // ── Mouse ──────────────────────────────────────────────────────────────
  protected onCellMouseDown(event: MouseEvent, r: number, c: number): void {
    if (event.button !== 0) return;
    if (this.isEditing(r, c)) return;
    event.preventDefault();
    this.commitEdit();
    this.focusGrid();
    if (event.shiftKey) {
      this.extent.set({ r, c });
    } else {
      this.cursor.set({ r, c });
      this.extent.set({ r, c });
    }
    this.dragMode = 'cells';
  }

  protected onCellMouseEnter(r: number, c: number): void {
    if (this.dragMode === 'cells') {
      this.extent.set({ r, c });
    } else if (this.dragMode === 'rows') {
      this.extent.set({ r, c: BULK_COLUMNS.length - 1 });
    } else if (this.dragMode === 'fill') {
      this.fillTarget.set(this.computeFillTarget(r, c));
    }
  }

  protected onCellDblClick(r: number, c: number): void {
    const row = this.rows()[r];
    const col = BULK_COLUMNS[c];
    if (!row || !this.editable(row, col.key)) return;
    if (col.type === 'bool') return;
    this.startEdit(r, c, null, 'edit');
  }

  /** Clic en el interruptor de una celda Sí/No: lo cambia directamente. */
  protected onToggleClick(event: MouseEvent, r: number, c: number): void {
    event.stopPropagation();
    if (event.shiftKey || event.metaKey || event.ctrlKey) return;
    const row = this.rows()[r];
    const col = BULK_COLUMNS[c];
    if (!row || !this.editable(row, col.key)) return;
    this.setCells([{ row, col: col.key, value: !this.value(row, col.key) }]);
  }

  protected onRowHeaderMouseDown(event: MouseEvent, r: number): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.commitEdit();
    this.focusGrid();
    const last = BULK_COLUMNS.length - 1;
    if (event.shiftKey) {
      this.cursor.set({ r: this.cursor().r, c: 0 });
      this.extent.set({ r, c: last });
    } else {
      this.cursor.set({ r, c: 0 });
      this.extent.set({ r, c: last });
    }
    this.dragMode = 'rows';
  }

  protected onColHeaderMouseDown(event: MouseEvent, c: number): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.commitEdit();
    this.focusGrid();
    const last = Math.max(0, this.rows().length - 1);
    if (event.shiftKey) {
      this.cursor.set({ r: 0, c: this.cursor().c });
      this.extent.set({ r: last, c });
    } else {
      this.cursor.set({ r: 0, c });
      this.extent.set({ r: last, c });
    }
    this.dragMode = 'cols';
  }

  protected onColHeaderMouseEnter(c: number): void {
    if (this.dragMode === 'cols') {
      this.extent.set({ r: Math.max(0, this.rows().length - 1), c });
    }
  }

  protected selectAll(): void {
    this.commitEdit();
    this.focusGrid();
    this.cursor.set({ r: 0, c: 0 });
    this.extent.set({ r: Math.max(0, this.rows().length - 1), c: BULK_COLUMNS.length - 1 });
  }

  protected onFillHandleMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    this.focusGrid();
    this.dragMode = 'fill';
    this.fillTarget.set(null);
  }

  private computeFillTarget(r: number, c: number): CellRange | null {
    const g = this.range();
    if (r > g.r2) return { r1: g.r2 + 1, r2: r, c1: g.c1, c2: g.c2 };
    if (r < g.r1) return { r1: r, r2: g.r1 - 1, c1: g.c1, c2: g.c2 };
    if (c > g.c2) return { r1: g.r1, r2: g.r2, c1: g.c2 + 1, c2: c };
    if (c < g.c1) return { r1: g.r1, r2: g.r2, c1: c, c2: g.c1 - 1 };
    return null;
  }

  /** Rellena el destino repitiendo el bloque seleccionado (como arrastrar el
   *  cuadrito de Excel). */
  private applyFill(target: CellRange): void {
    const g = this.range();
    const rows = this.rows();
    const h = g.r2 - g.r1 + 1;
    const w = g.c2 - g.c1 + 1;
    const changes: CellChange[] = [];
    for (let r = target.r1; r <= target.r2; r++) {
      for (let c = target.c1; c <= target.c2; c++) {
        const sr = r < g.r1 ? g.r2 - ((g.r1 - 1 - r) % h) : r > g.r2 ? g.r1 + ((r - g.r2 - 1) % h) : r;
        const sc = c < g.c1 ? g.c2 - ((g.c1 - 1 - c) % w) : c > g.c2 ? g.c1 + ((c - g.c2 - 1) % w) : c;
        const src = rows[sr];
        const dst = rows[r];
        const col = BULK_COLUMNS[c].key;
        const srcCol = BULK_COLUMNS[sc].key;
        if (!src || !dst || !this.applies(src, srcCol)) continue;
        const v = this.value(src, srcCol);
        if (v === undefined) continue;
        changes.push({ row: dst, col, value: v });
      }
    }
    this.setCells(changes);
    this.cursor.set({ r: Math.min(g.r1, target.r1), c: Math.min(g.c1, target.c1) });
    this.extent.set({ r: Math.max(g.r2, target.r2), c: Math.max(g.c2, target.c2) });
  }

  // ── Auto-scroll al arrastrar cerca del borde (seleccionar o rellenar más
  // allá de lo que se ve, como en Excel) ─────────────────────────────────
  private lastMouse: { x: number; y: number } | null = null;
  private autoScrollTimer: ReturnType<typeof setInterval> | null = null;

  @HostListener('document:mousemove', ['$event'])
  protected onDocumentMouseMove(event: MouseEvent): void {
    if (!this.dragMode) return;
    this.lastMouse = { x: event.clientX, y: event.clientY };
    if (!this.autoScrollTimer) {
      this.autoScrollTimer = setInterval(() => this.autoScrollTick(), 40);
    }
  }

  private stopAutoScroll(): void {
    if (this.autoScrollTimer) clearInterval(this.autoScrollTimer);
    this.autoScrollTimer = null;
  }

  private autoScrollTick(): void {
    const el = this.scroller()?.nativeElement;
    const m = this.lastMouse;
    if (!el || !m || !this.dragMode) return this.stopAutoScroll();
    const rect = el.getBoundingClientRect();
    const edge = 24;
    const speed = (d: number) => Math.min(40, Math.round(d / 2) + 6);
    let dy = 0;
    let dx = 0;
    if (this.dragMode !== 'cols') {
      if (m.y > rect.bottom - edge) dy = speed(m.y - (rect.bottom - edge));
      else if (m.y < rect.top + HEADER_H) dy = -speed(rect.top + HEADER_H - m.y);
    }
    if (this.dragMode !== 'rows') {
      if (m.x > rect.right - edge) dx = speed(m.x - (rect.right - edge));
      else if (m.x < rect.left + this.stickyWidth) dx = -speed(rect.left + this.stickyWidth - m.x);
    }
    if (!dy && !dx) return;
    const top = el.scrollTop;
    const left = el.scrollLeft;
    el.scrollTop += dy;
    el.scrollLeft += dx;
    if (el.scrollTop === top && el.scrollLeft === left) return;

    // Celda que quedó debajo del mouse tras desplazar.
    const y = Math.min(Math.max(m.y, rect.top + HEADER_H + 1), rect.bottom - 2);
    const x = Math.min(Math.max(m.x, rect.left + ROWNUM_W + 1), rect.right - 2);
    const r = Math.floor((y - rect.top - HEADER_H + el.scrollTop) / ROW_H);
    const contentX = x - rect.left + (x < rect.left + this.stickyWidth ? 0 : el.scrollLeft);
    let c = this.colLeft.findIndex((l, i) => contentX >= l && contentX < l + BULK_COLUMNS[i].width);
    if (c < 0) c = BULK_COLUMNS.length - 1;
    const p = this.clampPos({ r, c });
    if (this.dragMode === 'cols') this.onColHeaderMouseEnter(p.c);
    else this.onCellMouseEnter(p.r, p.c);
  }

  @HostListener('document:mouseup')
  protected onDocumentMouseUp(): void {
    if (this.dragMode === 'fill') {
      const target = this.fillTarget();
      if (target) this.applyFill(target);
      this.fillTarget.set(null);
    }
    this.dragMode = null;
    this.lastMouse = null;
    this.stopAutoScroll();
  }

  // ── Edición de una celda ────────────────────────────────────────────────
  private startEdit(r: number, c: number, initial: string | null, mode: 'enter' | 'edit'): void {
    const row = this.rows()[r];
    const col = BULK_COLUMNS[c];
    if (!row || !this.editable(row, col.key) || col.type === 'bool') return;
    const current = this.value(row, col.key);
    this.cursor.set({ r, c });
    this.extent.set({ r, c });
    this.ensureVisible({ r, c });
    this.editing.set({
      r,
      c,
      value: initial ?? (typeof current === 'string' ? current : ''),
      mode,
    });
  }

  protected onEditorInput(value: string): void {
    const e = this.editing();
    if (e) this.editing.set({ ...e, value });
  }

  private commitEdit(): void {
    const e = this.editing();
    if (!e) return;
    this.editing.set(null);
    const row = this.rows()[e.r];
    if (!row) return;
    this.setCells([{ row, col: BULK_COLUMNS[e.c].key, value: e.value }]);
  }

  private cancelEdit(): void {
    this.editing.set(null);
    this.focusGrid();
  }

  protected onEditorBlur(): void {
    // Clic fuera de la grilla (o en otra celda, que ya confirmó antes).
    this.commitEdit();
  }

  protected onEditorKeyDown(event: KeyboardEvent): void {
    const e = this.editing();
    if (!e) return;
    const move = (dr: number, dc: number) => {
      event.preventDefault();
      this.commitEdit();
      this.focusGrid();
      this.select({ r: e.r + dr, c: e.c + dc });
    };
    switch (event.key) {
      case 'Enter':
        return move(event.shiftKey ? -1 : 1, 0);
      case 'Tab':
        return move(0, event.shiftKey ? -1 : 1);
      case 'Escape':
        event.preventDefault();
        return this.cancelEdit();
      case 'ArrowUp':
        if (e.mode === 'enter') move(-1, 0);
        return;
      case 'ArrowDown':
        if (e.mode === 'enter') move(1, 0);
        return;
      case 'ArrowLeft':
        if (e.mode === 'enter') move(0, -1);
        return;
      case 'ArrowRight':
        if (e.mode === 'enter') move(0, 1);
        return;
    }
  }

  // ── Teclado de la grilla ────────────────────────────────────────────────
  protected onGridKeyDown(event: KeyboardEvent): void {
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key;
    // Las teclas del input del editor ya las maneja onEditorKeyDown (y al
    // burbujear hasta aquí no deben volver a procesarse).
    if (event.target instanceof HTMLInputElement) return;
    const editing = this.editing();
    if (editing) {
      // Teclas que llegan antes de que el input del editor tome el foco (se
      // escribe rápido justo después de la primera letra): no se pierden.
      if (mod && key.toLowerCase() === 'a') {
        event.preventDefault();
        const el = this.editor()?.nativeElement;
        el?.focus();
        el?.select();
      } else if (key.length === 1 && !mod && !event.altKey) {
        event.preventDefault();
        this.editing.set({ ...editing, value: editing.value + key });
      } else if (key === 'Backspace') {
        event.preventDefault();
        this.editing.set({ ...editing, value: editing.value.slice(0, -1) });
      } else {
        this.onEditorKeyDown(event);
      }
      return;
    }
    if (mod && !event.altKey && key.toLowerCase() === 'v') {
      // Algunos navegadores no disparan "paste" si el foco no está en un
      // campo editable: en ese caso se lee el portapapeles directamente.
      this.pasteHandled = false;
      setTimeout(async () => {
        if (this.pasteHandled) return;
        try {
          const text = await navigator.clipboard.readText();
          if (text) this.pasteMatrix(parseTsv(text));
        } catch {
          this.toastService.info('Usa Ctrl+V con la grilla seleccionada para pegar');
        }
      }, 80);
      return;
    }
    const cur = this.cursor();
    const ext = this.extent();
    const lastR = Math.max(0, this.rows().length - 1);
    const lastC = BULK_COLUMNS.length - 1;
    const page = Math.max(1, Math.floor((this.viewportH() - HEADER_H) / ROW_H) - 1);

    const go = (dr: number, dc: number) => {
      event.preventDefault();
      // Con Ctrl/Cmd salta al borde, como en Excel.
      const from = event.shiftKey ? ext : cur;
      const target = mod
        ? { r: dr ? (dr > 0 ? lastR : 0) : from.r, c: dc ? (dc > 0 ? lastC : 0) : from.c }
        : { r: from.r + dr, c: from.c + dc };
      if (event.shiftKey) this.select(cur, target, target);
      else this.select(target);
    };

    if (mod && !event.altKey) {
      switch (key.toLowerCase()) {
        case 'a':
          event.preventDefault();
          return this.selectAll();
        case 'z':
          event.preventDefault();
          return event.shiftKey ? this.redo() : this.undo();
        case 'y':
          event.preventDefault();
          return this.redo();
        case 'd':
          event.preventDefault();
          return this.fillDown();
        case 'r':
          event.preventDefault();
          return this.fillRight();
        case 's':
          event.preventDefault();
          this.save();
          return;
        case 'home':
          event.preventDefault();
          return this.select({ r: 0, c: 0 });
        case 'end':
          event.preventDefault();
          return this.select({ r: lastR, c: lastC });
      }
    }

    switch (key) {
      case 'ArrowUp':
        return go(-1, 0);
      case 'ArrowDown':
        return go(1, 0);
      case 'ArrowLeft':
        return go(0, -1);
      case 'ArrowRight':
        return go(0, 1);
      case 'Tab':
        event.preventDefault();
        return this.select({ r: cur.r, c: cur.c + (event.shiftKey ? -1 : 1) });
      case 'PageDown':
        return go(page, 0);
      case 'PageUp':
        return go(-page, 0);
      case 'Home':
        event.preventDefault();
        return this.select({ r: cur.r, c: 0 });
      case 'End':
        event.preventDefault();
        return this.select({ r: cur.r, c: lastC });
      case 'Escape':
        event.preventDefault();
        return this.select(cur);
      case 'Delete':
      case 'Backspace':
        event.preventDefault();
        return this.clearRange();
      case 'Enter':
      case 'F2': {
        event.preventDefault();
        if (key === 'Enter' && event.shiftKey) return this.select({ r: cur.r - 1, c: cur.c });
        const col = BULK_COLUMNS[cur.c];
        const row = this.rows()[cur.r];
        if (row && col.type === 'bool') return this.toggleRange();
        return this.startEdit(cur.r, cur.c, null, 'edit');
      }
      case ' ': {
        if (BULK_COLUMNS[cur.c].type === 'bool') {
          event.preventDefault();
          return this.toggleRange();
        }
        break;
      }
    }

    // Tecla imprimible → empieza a escribir reemplazando el contenido.
    if (key.length === 1 && !mod && !event.altKey) {
      const col = BULK_COLUMNS[cur.c];
      const row = this.rows()[cur.r];
      if (!row) return;
      event.preventDefault();
      if (col.type === 'bool') {
        const b = parseBulkBool(key);
        if (b !== null && key !== ' ') this.setRange(() => b, 'bool');
        return;
      }
      this.startEdit(cur.r, cur.c, key, 'enter');
    }
  }

  /** Recorre las celdas del rango seleccionado. */
  private forRange(fn: (row: BulkRow, col: BulkColumn) => void): void {
    const g = this.range();
    const rows = this.rows();
    for (let r = g.r1; r <= g.r2; r++) {
      const row = rows[r];
      if (!row) continue;
      for (let c = g.c1; c <= g.c2; c++) fn(row, BULK_COLUMNS[c]);
    }
  }

  private setRange(
    valueFor: (row: BulkRow, col: BulkColumn) => BulkCellValue | undefined,
    onlyType?: BulkColumn['type']
  ): void {
    const changes: CellChange[] = [];
    this.forRange((row, col) => {
      if (onlyType && col.type !== onlyType) return;
      const value = valueFor(row, col);
      if (value !== undefined) changes.push({ row, col: col.key, value });
    });
    this.setCells(changes);
  }

  /** Borrar: vacía textos y números (las columnas Sí/No no se tocan). */
  private clearRange(): void {
    this.setRange((_, col) => (col.type === 'bool' ? undefined : ''));
  }

  /** Espacio/Enter en Sí/No: todas las celdas toman el valor contrario al de
   *  la celda activa. */
  private toggleRange(): void {
    const cur = this.cursor();
    const row = this.rows()[cur.r];
    const colKey = BULK_COLUMNS[cur.c].key;
    const base = row && this.applies(row, colKey) ? !!this.value(row, colKey) : false;
    this.setRange(() => !base, 'bool');
  }

  /** Ctrl+D: copia la primera fila del rango hacia abajo. */
  private fillDown(): void {
    const g = this.range();
    const rows = this.rows();
    const src = rows[g.r1];
    if (!src || g.r2 === g.r1) return;
    const changes: CellChange[] = [];
    for (let r = g.r1 + 1; r <= g.r2; r++) {
      for (let c = g.c1; c <= g.c2; c++) {
        const col = BULK_COLUMNS[c].key;
        const v = this.applies(src, col) ? this.value(src, col) : undefined;
        if (v !== undefined) changes.push({ row: rows[r], col, value: v });
      }
    }
    this.setCells(changes);
  }

  /** Ctrl+R: copia la primera columna del rango hacia la derecha (solo entre
   *  columnas del mismo tipo). */
  private fillRight(): void {
    const g = this.range();
    if (g.c2 === g.c1) return;
    const rows = this.rows();
    const srcCol = BULK_COLUMNS[g.c1];
    const changes: CellChange[] = [];
    for (let r = g.r1; r <= g.r2; r++) {
      const row = rows[r];
      const v = row && this.applies(row, srcCol.key) ? this.value(row, srcCol.key) : undefined;
      if (v === undefined) continue;
      for (let c = g.c1 + 1; c <= g.c2; c++) {
        if (BULK_COLUMNS[c].type === srcCol.type) changes.push({ row, col: BULK_COLUMNS[c].key, value: v });
      }
    }
    this.setCells(changes);
  }

  // ── Portapapeles ──────────────────────────────────────────────────────
  private rangeAsTsv(): string {
    const g = this.range();
    const rows = this.rows();
    const matrix: string[][] = [];
    for (let r = g.r1; r <= g.r2; r++) {
      const row = rows[r];
      if (!row) continue;
      const line: string[] = [];
      for (let c = g.c1; c <= g.c2; c++) line.push(this.display(row, BULK_COLUMNS[c]));
      matrix.push(line);
    }
    return toTsv(matrix);
  }

  protected onCopy(event: ClipboardEvent): void {
    if (this.editing()) return;
    event.preventDefault();
    event.clipboardData?.setData('text/plain', this.rangeAsTsv());
    const n = this.selectionSize();
    if (n > 1) this.toastService.info(`${n} celdas copiadas`);
  }

  protected onCut(event: ClipboardEvent): void {
    if (this.editing()) return;
    this.onCopy(event);
    this.clearRange();
  }

  private pasteHandled = true;

  protected onPaste(event: ClipboardEvent): void {
    if (this.editing()) return;
    this.pasteHandled = true;
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    if (!text) return;
    this.pasteMatrix(parseTsv(text));
  }

  private pasteMatrix(matrix: string[][]): void {
    const g = this.range();
    const rows = this.rows();
    const mh = matrix.length;
    const mw = Math.max(...matrix.map((r) => r.length));
    const selH = g.r2 - g.r1 + 1;
    const selW = g.c2 - g.c1 + 1;
    // Si el rango seleccionado es múltiplo de lo copiado (p. ej. un solo valor
    // y 50 filas seleccionadas), se repite para llenarlo, como en Excel.
    const tile = (selH > mh || selW > mw) && selH % mh === 0 && selW % mw === 0;
    const h = tile ? selH : mh;
    const w = tile ? selW : mw;

    const changes: CellChange[] = [];
    let skipped = 0;
    for (let i = 0; i < h; i++) {
      const row = rows[g.r1 + i];
      if (!row) break;
      for (let j = 0; j < w; j++) {
        const col = BULK_COLUMNS[g.c1 + j];
        if (!col) break;
        const raw = matrix[i % mh][j % mw] ?? '';
        if (!this.editable(row, col.key)) continue;
        if (col.type === 'bool') {
          const b = parseBulkBool(raw);
          if (b === null) {
            skipped++;
            continue;
          }
          changes.push({ row, col: col.key, value: b });
        } else {
          changes.push({ row, col: col.key, value: col.type === 'number' ? raw.trim() : raw });
        }
      }
    }
    const changed = this.setCells(changes);
    this.cursor.set({ r: g.r1, c: g.c1 });
    this.extent.set(
      this.clampPos({ r: g.r1 + h - 1, c: g.c1 + w - 1 })
    );
    if (skipped) this.toastService.warning(`${skipped} celdas Sí/No no se entendieron y no se pegaron`);
    else if (changed > 1) this.toastService.info(`${changed} celdas pegadas`);
  }

  // ── Guardar / descartar ─────────────────────────────────────────────────
  protected discard(): void {
    if (!this.edits().size) return;
    if (!window.confirm('¿Descartar todos los cambios sin guardar?')) return;
    this.edits.set(new Map());
    this.saveErrors.set(new Map());
    this.undoStack = [];
    this.redoStack = [];
  }

  protected async save(): Promise<void> {
    this.commitEdit();
    if (!this.edits().size || this.isSaving()) return;
    if (this.errorCount() > 0) {
      this.toastService.warning('Corrige las celdas en rojo antes de guardar');
      this.goToFirstError();
      return;
    }
    const patches = buildBulkPatches(this.allRows(), this.edits());
    this.isSaving.set(true);
    const result = await this.productService.bulkUpdate(patches);
    this.isSaving.set(false);

    result
      .mapRight(({ failed }) => {
        const failedIds = new Set(failed.map((f) => f.productId));
        const byKey = this.rowByKey();
        const remaining: BulkEdits = new Map();
        for (const [key, values] of this.edits()) {
          const row = byKey.get(key);
          if (row && failedIds.has(row.productId)) remaining.set(key, values);
        }
        this.edits.set(remaining);
        this.saveErrors.set(new Map(failed.map((f) => [f.productId, f.message])));
        this.undoStack = [];
        this.redoStack = [];

        const ok = patches.length - failedIds.size;
        if (ok > 0) {
          this.toastService.success(
            ok === 1 ? '1 producto guardado' : `${ok} productos guardados`
          );
        }
        if (failed.length) {
          this.toastService.error(
            new Exception(
              failed.length === 1
                ? `No se pudo guardar 1 producto: ${failed[0].message}`
                : `No se pudieron guardar ${failed.length} productos. Revisa las filas marcadas en rojo.`
            )
          );
        }
        // Refresca la grilla con lo guardado y el listado de productos.
        this.load();
        this.productStore.productList$();
      })
      .mapLeft((err) => this.toastService.error(new Exception(err.message)));
  }

  private goToFirstError(): void {
    const errors = this.errors();
    const rows = this.rows();
    const r = rows.findIndex((row) => errors.has(row.key));
    if (r < 0) {
      // El error está en una fila oculta por el filtro.
      this.search.set('');
      this.onlyModified.set(true);
      return;
    }
    const cols = errors.get(rows[r].key) ?? {};
    const c = BULK_COLUMNS.findIndex((col) => col.key in cols);
    this.select({ r, c: Math.max(0, c) });
    this.focusGrid();
  }

  protected back(): void {
    this.router.navigate(['/admin/products']);
  }

  /** Guard de salida (ver product.routes.ts). */
  public canLeave(): boolean {
    this.commitEdit();
    if (!this.edits().size) return true;
    return window.confirm('Tienes cambios sin guardar. ¿Salir de todas formas?');
  }

  @HostListener('window:beforeunload', ['$event'])
  protected onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.edits().size) {
      event.preventDefault();
      event.returnValue = '';
    }
  }

  /** Al cambiar el filtro la selección vuelve al inicio. */
  private resetSelection(): void {
    this.cursor.set({ r: 0, c: 0 });
    this.extent.set({ r: 0, c: 0 });
  }

  protected onSearch(value: string): void {
    this.commitEdit();
    this.search.set(value);
    this.resetSelection();
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollTop = 0;
  }

  protected toggleOnlyModified(): void {
    this.commitEdit();
    this.onlyModified.update((v) => !v);
    this.resetSelection();
    const el = this.scroller()?.nativeElement;
    if (el) el.scrollTop = 0;
  }

  protected isMoneyCol(col: BulkColumn): boolean {
    return ['price', 'pricePromotional', 'originalPrice', 'productionCost'].includes(col.key);
  }

  protected trackRow = (_: number, item: { row: BulkRow }) => item.row.key;
}
