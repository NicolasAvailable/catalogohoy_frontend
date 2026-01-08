import { inject, Injectable } from '@angular/core';
import { CreateProductInput } from '../domain';
import { ProductService } from '../infrastructure';
import { CreateProductUseCase } from './create-product/create-product.usecase';

@Injectable({ providedIn: 'root' })
export class ProductFacade {
  private readonly productService = inject(ProductService);

  public create(input: CreateProductInput) {
    return new CreateProductUseCase(this.productService).execute(input);
  }
}
