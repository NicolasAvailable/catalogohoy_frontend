import { Component, inject, signal } from '@angular/core';
import { IconComponent, InputSearchComponent } from '@ui';
import { CartStore, EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-catalog-header',
  imports: [IconComponent, InputSearchComponent],
  templateUrl: './catalog-header.html',
  styleUrl: './catalog-header.css',
})
export class CatalogHeader {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cartStore = inject(CartStore);
  public readonly searchValue = signal('');

  onSearch(value: string) {
    this.searchValue.set(value);
    // Emit to parent or directly update store
  }
}
