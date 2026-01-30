import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '@catalogohoy/product';
import { IconComponent } from '@ui';

@Component({
  selector: 'lib-product-card',
  imports: [RouterLink, IconComponent],
  templateUrl: './product-card.html',
  styleUrl: './product-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProductCard {
  public readonly product = input.required<Product>();
  public readonly viewMode = input<'grid' | 'list'>('grid');
  public readonly addToCart = output<Product>();

  onAddToCart(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.addToCart.emit(this.product());
  }

  get displayPrice(): number {
    const p = this.product();
    return p.pricePromotional > 0 ? p.pricePromotional : p.price;
  }

  get hasDiscount(): boolean {
    const p = this.product();
    return p.pricePromotional > 0 && p.pricePromotional < p.price;
  }

  get mainPhoto(): string {
    const p = this.product();
    return p.photos[0] || 'assets/placeholder-product.png';
  }
}
