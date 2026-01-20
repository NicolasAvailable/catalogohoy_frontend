import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { E } from '@shared/domain';
import {
  BaseProductService,
  CreateProductInput,
  Product,
  ProductList,
  UpdateProductInput,
} from '../domain';
import { ProductEntity } from './entities';
import { ProductListMapper } from './mappers';

@Injectable({
  providedIn: 'root',
})
export class ProductService implements BaseProductService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async getAll(
    page?: number,
    pageSize?: number
  ): Promise<E.Either<Error, ProductList>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) {
      return E.left(new Error('User not authenticated'));
    }

    let query = this.client
      .from('products')
      .select('*')
      .eq('auth_user_id', user.id)
      .order('id', { ascending: true });

    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      return E.left(error);
    }
    return E.right(ProductListMapper.toDomain(data as ProductEntity[]));
  }

  public async getById(id: string): Promise<E.Either<Error, Product>> {
    const { data, error } = await this.client
      .from('products')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return E.left(error);
    }

    const entity = data as ProductEntity;

    return E.right(
      Product.create({
        id: entity.id,
        name: entity.name,
        description: entity.description,
        price: entity.price,
        pricePromotional: entity.price_promotional,
        photos: entity.photos,
        stock: entity.stock,
        authUserId: entity.auth_user_id,
        createdAt: entity.created_at,
      })
    );
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
        price_promotional:
          input.pricePromotional.length === 0 ? null : input.pricePromotional,
        photos: input.photos,
        auth_user_id: user.id,
        stock: input.stock,
      })
      .select('*');

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }

  public async update(
    input: UpdateProductInput
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('products')
      .update({
        name: input.name,
        description: input.description,
        price: input.price,
        price_promotional: input.pricePromotional,
        photos: input.photos,
        stock: input.stock,
      })
      .eq('id', input.id)
      .select('*');

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }

  public async delete(id: string): Promise<E.Either<Error, void>> {
    const { error } = await this.client.from('products').delete().eq('id', id);

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }
}
