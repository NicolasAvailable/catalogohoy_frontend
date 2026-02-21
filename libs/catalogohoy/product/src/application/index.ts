import { inject, Injectable } from '@angular/core';
import { CreateProductInput, UpdateProductInput } from '../domain';
import { ProductService } from '../infrastructure';
import { CreateProductUseCase } from './create-product/create-product.usecase';
import { DeleteManyProductsUseCase } from './delete-many-products/delete-many-products.usecase';
import { DeleteProductUseCase } from './delete-product/delete-product.usecase';
import { GetByIdUseCase } from './get-by-id/get-by-id.usecase';
import { UpdateProductUseCase } from './update-product/update-product.usecase';

@Injectable({ providedIn: 'root' })
export class ProductFacade {
  private readonly productService = inject(ProductService);

  public create(input: CreateProductInput) {
    return new CreateProductUseCase(this.productService).execute(input);
  }

  public getById(id: string) {
    return new GetByIdUseCase(this.productService).execute(id);
  }

  public update(input: UpdateProductInput) {
    return new UpdateProductUseCase(this.productService).execute(input);
  }

  public delete(id: string) {
    return new DeleteProductUseCase(this.productService).execute(id);
  }

  public deleteMany(ids: string[]) {
    return new DeleteManyProductsUseCase(this.productService).execute(ids);
  }
}
