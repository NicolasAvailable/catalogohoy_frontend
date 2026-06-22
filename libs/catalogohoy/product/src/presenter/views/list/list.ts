import {
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormControl, FormGroup, FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { CategoryStore } from '@catalogohoy/category';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { PlanLimitDialogComponent, PlanStore } from '@catalogohoy/plan';
import { TenantStore } from '@catalogohoy/tenant';
import {
  ButtonComponent,
  CheckboxComponent,
  ConfirmDialogComponent,
  DialogComponent,
  IconComponent,
  InputTextComponent,
  MultiSelectComponent,
  ProductMediaComponent,
  SelectComponent,
  SkeletonListComponent,
  TooltipDirective,
} from '@ui';
import { firstImageUrl } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { ProductFacade } from '../../../application';
import { Product, ProductList } from '../../../domain';
import { ProductService, ProductStore } from '../../../infrastructure';
import { ImportExportHubComponent } from '../import-export/import-export-hub';

@Component({
  selector: 'lib-list',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    DragDropModule,
    PaginatorModule,
    SkeletonListComponent,
    ButtonComponent,
    SelectComponent,
    InputTextComponent,
    IconComponent,
    ConfirmDialogComponent,
    ImportExportHubComponent,
    CheckboxComponent,
    PlanLimitDialogComponent,
    TooltipDirective,
    DialogComponent,
    MultiSelectComponent,
    ProductMediaComponent,
  ],
  templateUrl: './list.html',
  styleUrl: './list.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export default class List implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly permissions = inject(TeamPermissionsStore);
  private readonly productService = inject(ProductService);
  private readonly toastService = inject(ToastService);
  protected readonly canCreateProduct = computed(() => this.permissions.isOwner() || this.permissions.can()('productos', 'create'));
  protected readonly canDeleteProduct = computed(() => this.permissions.isOwner() || this.permissions.can()('productos', 'delete'));
  public readonly productStore = inject(ProductStore);
  public readonly productFacade = inject(ProductFacade);
  public readonly planStore = inject(PlanStore);
  public readonly categoryStore = inject(CategoryStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly tenantStore = inject(TenantStore);
  // Venezuela exception: prices in the admin product list are maintained in
  // USD even though the public catalog renders them in Bs. via the BCV rate.
  // Force '$' here so the admin sees the actual stored value, not the
  // computed local symbol.
  public readonly cs = computed(() =>
    this.tenantCurrency.isVenezuela() ? '$' : this.tenantCurrency.localSymbol() || '$'
  );

  /** Choose the URL to show in the product-row thumbnail. Prefer an
   *  image so the list stays cheap to render; fall back to the first
   *  media (likely a video) when the product has no images at all.
   *  Empty string means "no media" → caller renders a placeholder. */
  public thumbnailUrl(item: Product): string {
    return firstImageUrl(item.photos) ?? item.photos[0] ?? '';
  }
  public readonly selectedProduct = signal<Product | null>(null);
  public readonly selectedIds = signal<Set<string>>(new Set());
  public readonly deleteMode = signal<'single' | 'bulk'>('single');
  public readonly pageFirst = signal(0);
  public readonly pageRows = signal(10);

  public readonly isProcessing = signal(false);
  public readonly bulkCategoryIds = signal<string[]>([]);
  public readonly filterCategoryId = signal<string | null>(null);
  /** ID del producto cuya URL pública se acaba de copiar — usado para mostrar
   *  el feedback "¡Link copiado!" en el tooltip del botón de compartir por
   *  unos segundos. */
  public readonly copiedId = signal<string | null>(null);

  public readonly hasSelection = computed(() => this.selectedIds().size > 0);

  public readonly filteredProducts = computed(() => {
    const products = this.productStore.productList().products;
    const categoryId = this.filterCategoryId();
    if (!categoryId) return products;
    return products.filter((p) => p.categoryList.ids.includes(categoryId));
  });

  public readonly currentPageItems = computed(() => {
    const products = this.filteredProducts();
    return products.slice(this.pageFirst(), this.pageFirst() + this.pageRows());
  });

  /** Products locked by the free-plan limit. When a tenant is downgraded to the
   *  free plan and has more products than it allows, only the first `maxProducts`
   *  visible (non-hidden) products — by their `position` order, same as the
   *  public catalog — stay active. The rest are kept in the DB but locked here:
   *  not visible in the storefront and not editable until they upgrade. */
  public readonly lockedIds = computed(() => {
    const locked = new Set<string>();
    if (!this.planStore.isFreePlan()) return locked;
    const cap = this.planStore.maxProducts();
    if (cap <= 0) return locked; // 0 = unlimited sentinel
    let rank = 0;
    for (const p of this.productStore.productList().products) {
      if (p.isHidden) continue; // hidden products don't consume a visible slot
      if (rank >= cap) locked.add(String(p.id));
      rank++;
    }
    return locked;
  });

  public isLocked(item: Product): boolean {
    return this.lockedIds().has(String(item.id));
  }

  /** Intercepts an edit attempt on a plan-locked product: surfaces the upgrade
   *  dialog instead of navigating. No-op for unlocked products. */
  public onLockedAttempt(item: Product): void {
    if (this.isLocked(item)) {
      this.planLimitDialog.show();
    }
  }

  public readonly isAllPageSelected = computed(() => {
    const pageItems = this.currentPageItems();
    if (pageItems.length === 0) return false;
    const ids = this.selectedIds();
    return pageItems.every((p) => ids.has(String(p.id)));
  });

  @ViewChild(ConfirmDialogComponent)
  public confirmDialog!: ConfirmDialogComponent;

  @ViewChild(ImportExportHubComponent)
  public importExportHub!: ImportExportHubComponent;

  @ViewChild(PlanLimitDialogComponent)
  public planLimitDialog!: PlanLimitDialogComponent;

  @ViewChild('categoryDialog')
  public categoryDialog!: DialogComponent;

  public searchForm = new FormGroup({
    search: new FormControl('', []),
  });

  private searchSubscription?: Subscription;

  private readonly clampPageFirstOnOverflow = effect(() => {
    const total = this.filteredProducts().length;
    const first = this.pageFirst();
    const rows = this.pageRows();
    if (total === 0) {
      if (first !== 0) this.pageFirst.set(0);
      return;
    }
    if (first >= total) {
      const lastPageFirst = Math.floor((total - 1) / rows) * rows;
      this.pageFirst.set(lastPageFirst);
    }
  });

  ngOnInit() {
    // Prime tenant currency cache (localStorage → DB fallback)
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) this.tenantCurrency.load(tid);
    });

    this.productStore.productList$();
    this.planStore.loadTenantPlanUsage();
    this.categoryStore.categoryList$(1, 100);

    this.searchSubscription = this.searchForm.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchTerm) => {
        this.clearSelection();
        this.productStore.productList$(searchTerm || '');
      });
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
  }

  public onCategoryFilterChange(categoryId: string | null): void {
    // The seeded "Ver todos" category clears the filter — same behavior as
    // the public catalog. Selecting it from the dropdown should show every
    // product, not filter to that pseudo-category.
    const category = this.categoryStore
      .categoryList()
      .categories.find((c) => c.id === categoryId);
    const resolvedId = category?.isViewAll ? null : categoryId;

    this.filterCategoryId.set(resolvedId);
    this.pageFirst.set(0);
    this.clearSelection();
  }

  public onPageChange(event: PaginatorState) {
    this.pageFirst.set(event.first ?? 0);
    this.pageRows.set(event.rows ?? 10);
  }

  public async drop(event: CdkDragDrop<Product[]>) {
    if (event.previousIndex === event.currentIndex) return;

    const offset = this.pageFirst();
    const products = [...this.productStore.productList().products];
    const movedItem = products.splice(offset + event.previousIndex, 1)[0];
    products.splice(offset + event.currentIndex, 0, movedItem);

    this.productStore.set(ProductList.from(products));
    await this.productService.updatePositions(products);
  }

  public toggleProduct(product: Product) {
    const ids = new Set(this.selectedIds());
    const id = String(product.id);
    if (ids.has(id)) {
      ids.delete(id);
    } else {
      ids.add(id);
    }
    this.selectedIds.set(ids);
  }

  public isSelected(product: Product): boolean {
    return this.selectedIds().has(String(product.id));
  }

  public toggleAllPage() {
    const pageItems = this.currentPageItems();
    const ids = new Set(this.selectedIds());
    const allSelected = this.isAllPageSelected();

    for (const p of pageItems) {
      if (allSelected) {
        ids.delete(String(p.id));
      } else {
        ids.add(String(p.id));
      }
    }
    this.selectedIds.set(ids);
  }

  public clearSelection() {
    this.selectedIds.set(new Set());
  }

  public onDelete(product: Product) {
    this.deleteMode.set('single');
    this.selectedProduct.set(product);
    this.confirmDialog.warning();
  }

  public onDeleteSelected() {
    this.deleteMode.set('bulk');
    this.confirmDialog.warning();
  }

  public onAssignCategories() {
    this.bulkCategoryIds.set([]);
    this.categoryDialog.show();
  }

  public onCreateProduct(): void {
    if (!this.planStore.canCreateProduct()) {
      this.planLimitDialog.show();
      return;
    }
    this.router.navigate(['/admin/products/create']);
  }

  /** Duplica un producto: crea una copia exacta con el sufijo "(copia)" y
   *  queda oculta por defecto (`is_hidden: true`) para que el dueño la
   *  ajuste antes de publicarla. */
  public async onDuplicate(product: Product): Promise<void> {
    if (this.isProcessing()) return;
    if (!this.planStore.canCreateProduct()) {
      this.planLimitDialog.show();
      return;
    }
    this.isProcessing.set(true);
    const result = await this.productFacade.duplicate(String(product.id));
    result.mapRight(() => {
      this.toastService.success('Producto duplicado correctamente');
      this.refreshList();
    });
    this.isProcessing.set(false);
  }

  /** Copia al portapapeles la URL pública del producto. Pattern:
   *  `https://{slug}.catalogohoy.com/?product={id}`. El catálogo público
   *  lee ese query param al cargar y abre el modal de detalle. */
  public async onShare(product: Product): Promise<void> {
    const slug = this.tenantStore.tenantSlug();
    if (!slug) return;
    const url = `https://${slug}.catalogohoy.com/?product=${product.id}`;
    try {
      await navigator.clipboard.writeText(url);
      this.copiedId.set(String(product.id));
      this.toastService.success('Link copiado al portapapeles');
      setTimeout(() => {
        if (this.copiedId() === String(product.id)) this.copiedId.set(null);
      }, 2000);
    } catch {
      /* clipboard puede no estar disponible en navegadores muy viejos */
    }
  }

  public openImportExport(): void {
    this.importExportHub.open();
  }

  public async onConfirmDelete() {
    if (this.isProcessing()) return;

    this.isProcessing.set(true);
    if (this.deleteMode() === 'single') {
      const product = this.selectedProduct();
      if (product) {
        const result = await this.productFacade.delete(String(product.id));
        result.mapRight(() => this.refreshList());
      }
    } else {
      const ids = Array.from(this.selectedIds());
      if (ids.length > 0) {
        const result = await this.productFacade.deleteMany(ids);
        result.mapRight(() => {
          this.clearSelection();
          this.refreshList();
        });
      }
    }
    this.isProcessing.set(false);
  }

  public async onConfirmCategoryAssign() {
    if (this.isProcessing()) return;

    this.isProcessing.set(true);
    const productIds = Array.from(this.selectedIds());
    const categoryIds = this.bulkCategoryIds();

    const result = await this.productFacade.replaceCategories({ productIds, categoryIds });
    result.mapRight(() => {
      this.categoryDialog.hide();
      this.clearSelection();
      this.refreshList();
    });
    this.isProcessing.set(false);
  }

  // Inline category creation from inside the category dropdown.
  public readonly newCategoryName = signal('');
  public readonly creatingCategory = signal(false);

  public async onCreateCategoryFromDropdown() {
    const name = this.newCategoryName().trim();
    if (!name || this.creatingCategory()) return;
    this.creatingCategory.set(true);
    const result = await this.categoryStore.save({ name, isVisible: true });
    this.creatingCategory.set(false);
    result.fold(
      () => this.toastService.warning('No se pudo crear la categoría'),
      (created) => {
        if (created) {
          this.bulkCategoryIds.set([
            ...this.bulkCategoryIds(),
            String(created.id),
          ]);
          this.newCategoryName.set('');
          this.toastService.success('Categoría creada');
        }
      }
    );
  }

  public getDeleteDialogContent(): string {
    if (this.deleteMode() === 'single') {
      return '¿Estás seguro de que deseas eliminar este producto? Esta acción es irreversible.';
    }
    return `¿Estás seguro de que deseas eliminar ${this.selectedIds().size} productos? Esta acción es irreversible.`;
  }

  private refreshList() {
    const currentSearch = this.searchForm.controls.search.value || '';
    this.productStore.productList$(currentSearch);
  }
}
