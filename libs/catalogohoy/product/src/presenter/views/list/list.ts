import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  ConfirmDialogComponent,
  IconComponent,
  InputTextComponent,
  TableComponent,
} from '@ui';
import { ProductFacade } from '../../../application';
import { Product } from '../../../domain';
import { ProductStore } from '../../../infrastructure';

@Component({
  selector: 'lib-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TableComponent,
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
export default class List implements OnInit {
  public readonly productStore = inject(ProductStore);
  public readonly productFacade = inject(ProductFacade);
  public readonly selectedProduct = signal<Product | null>(null);

  @ViewChild(ConfirmDialogComponent)
  public confirmDialog!: ConfirmDialogComponent;

  public searchForm = new FormGroup({
    search: new FormControl('', []),
  });

  ngOnInit() {
    this.productStore.productList$();
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
        this.productStore.productList$();
      });
    }
  }
}
