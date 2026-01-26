import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  ConfirmDialogComponent,
  IconComponent,
  InputTextComponent,
  SkeletonListComponent,
  TableComponent,
} from '@ui';
import { debounceTime, distinctUntilChanged, Subscription } from 'rxjs';
import { ProductFacade } from '../../../application';
import { Product } from '../../../domain';
import { ProductStore } from '../../../infrastructure';

@Component({
  selector: 'lib-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TableComponent,
    SkeletonListComponent,
    CardComponent,
    ButtonComponent,
    InputTextComponent,
    IconComponent,
    ConfirmDialogComponent,
  ],
  templateUrl: './list.html',
  styleUrl: './list.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export default class List implements OnInit, OnDestroy {
  public readonly productStore = inject(ProductStore);
  public readonly productFacade = inject(ProductFacade);
  public readonly selectedProduct = signal<Product | null>(null);

  @ViewChild(ConfirmDialogComponent)
  public confirmDialog!: ConfirmDialogComponent;

  public searchForm = new FormGroup({
    search: new FormControl('', []),
  });

  private searchSubscription?: Subscription;

  ngOnInit() {
    this.productStore.productList$();

    this.searchSubscription = this.searchForm.controls.search.valueChanges
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe((searchTerm) =>
        this.productStore.productList$(searchTerm || '')
      );
  }

  ngOnDestroy() {
    this.searchSubscription?.unsubscribe();
  }

  public onDelete(product: Product) {
    this.selectedProduct.set(product);
    this.confirmDialog.warning();
  }

  public async onConfirmDelete() {
    const product = this.selectedProduct();
    if (product) {
      const result = await this.productFacade.delete(String(product.id));
      result.mapRight(() => {
        const currentSearch = this.searchForm.controls.search.value || '';
        this.productStore.productList$(currentSearch);
      });
    }
  }
}
