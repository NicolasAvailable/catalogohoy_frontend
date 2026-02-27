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
import { PlanLimitDialogComponent, PlanStore } from '@catalogohoy/plan';
import {
  ButtonComponent,
  CardComponent,
  CheckboxComponent,
  ConfirmDialogComponent,
  IconComponent,
  InputTextComponent,
  SkeletonListComponent,
  TableComponent,
  TooltipDirective,
} from '@ui';
import { TablePageEvent } from 'primeng/table';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';
import { ProductFacade } from '../../../application';
import { Product } from '../../../domain';
import { ProductStore } from '../../../infrastructure';
import { ImportExportHubComponent } from '../import-export/import-export-hub';

@Component({
  selector: 'lib-list',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    TableComponent,
    SkeletonListComponent,
    CardComponent,
    ButtonComponent,
    InputTextComponent,
    IconComponent,
    ConfirmDialogComponent,
    ImportExportHubComponent,
    CheckboxComponent,
    PlanLimitDialogComponent,
    TooltipDirective,
  ],
  templateUrl: './list.html',
  styleUrl: './list.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export default class List implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  public readonly productStore = inject(ProductStore);
  public readonly productFacade = inject(ProductFacade);
  public readonly planStore = inject(PlanStore);
  public readonly selectedProduct = signal<Product | null>(null);
  public readonly selectedIds = signal<Set<string>>(new Set());
  public readonly deleteMode = signal<'single' | 'bulk'>('single');
  public readonly pageFirst = signal(0);
  public readonly pageRows = 10;

  public readonly hasSelection = computed(() => this.selectedIds().size > 0);

  public readonly currentPageItems = computed(() => {
    const products = this.productStore.productList().products;
    return products.slice(this.pageFirst(), this.pageFirst() + this.pageRows);
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

  public searchForm = new FormGroup({
    search: new FormControl('', []),
  });

  private searchSubscription?: Subscription;

  ngOnInit() {
    this.productStore.productList$();
    this.planStore.loadTenantPlanUsage();

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

  public onPageChange(event: TablePageEvent) {
    this.pageFirst.set(event.first);
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
