import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import { BaseProductService, CreateProductInput, ProductList } from '../domain';
import { ProductEntity } from './entities';
import { ProductListMapper } from './mappers';

@Injectable({
  providedIn: 'root',
})
export class ProductService implements BaseProductService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async getAll(): Promise<E.Either<Error, ProductList>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) {
      return E.left(new Error('User not authenticated'));
    }

    const { data, error } = await this.client
      .from('products')
      .select('*')
      .eq('auth_user_id', user.id);

    if (error) {
      return E.left(error);
    }

    return E.right(ProductListMapper.toDomain(data as ProductEntity[]));
  }

  public async create(
    input: CreateProductInput
  ): Promise<E.Either<Error, void>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) {
      return E.right(undefined);
    }

    const { error } = await this.client
      .from('products')
      .insert({
        name: input.name,
        description: input.description,
        price: input.price,
        price_promotional: input.pricePromotional,
        photo: '',
        auth_user_id: user.id,
        stock: input.stock,
      })
      .select('*');

    if (error) {
      return E.left(error);
    }
    return E.right(undefined);
  }
}
