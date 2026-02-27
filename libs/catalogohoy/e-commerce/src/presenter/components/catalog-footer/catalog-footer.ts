import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-catalog-footer',
  templateUrl: './catalog-footer.html',
  styleUrl: './catalog-footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFooter {
  public readonly ecommerceStore = inject(EcommerceStore);

  get currentYear(): number {
    return new Date().getFullYear();
  }
}
