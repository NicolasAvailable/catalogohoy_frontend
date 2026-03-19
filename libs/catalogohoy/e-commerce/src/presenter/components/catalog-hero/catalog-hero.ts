import { Component, inject } from '@angular/core';
import { EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-catalog-hero',
  standalone: true,
  templateUrl: './catalog-hero.html',
  styleUrl: './catalog-hero.css',
})
export class CatalogHero {
  readonly ecommerceStore = inject(EcommerceStore);
}
