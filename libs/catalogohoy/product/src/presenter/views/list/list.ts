import {
  Component,
  computed,
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
import { PlanLimitDialogComponent, PlanStore } from '@catalogohoy/plan';
import {
  ButtonComponent,
  CheckboxComponent,
  ConfirmDialogComponent,
  DialogComponent,
  IconComponent,
  InputTextComponent,
  MultiSelectComponent,
  SelectComponent,
  SkeletonListComponent,
  TooltipDirective,
} from '@ui';
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
  protected readonly canCreateProduct = computed(() => this.permissions.isOwner() || this.permissions.can()('productos', 'create'));
  protected readonly canDeleteProduct = computed(() => this.permissions.isOwner() || this.permissions.can()('productos', 'delete'));
  public readonly productStore = inject(ProductStore);
  public readonly productFacade = inject(ProductFacade);
  public readonly planStore = inject(PlanStore);
  public readonly categoryStore = inject(CategoryStore);
  public readonly selectedProduct = signal<Product | null>(null);
  public readonly selectedIds = signal<Set<string>>(new Set());
  public readonly deleteMode = signal<'single' | 'bulk'>('single');
  public readonly pageFirst = signal(0);
  public readonly pageRows = signal(10);

  public readonly isProcessing = signal(false);
  public readonly bulkCategoryIds = signal<string[]>([]);
  public readonly filterCategoryId = signal<string | null>(null);

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

  ngOnInit() {
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
    this.filterCategoryId.set(categoryId);
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
