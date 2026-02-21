import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import {
  BaseProductService,
  CreateProductInput,
  Product,
  ProductList,
  UpdateProductInput,
} from '../domain';
import { ProductEntity } from './entities';
import { ProductListMapper, ProductMapper } from './mappers';

@Injectable({
  providedIn: 'root',
})
export class ProductService implements BaseProductService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  public async getAll(
    page?: number,
    pageSize?: number,
    search?: string
  ): Promise<E.Either<Error, ProductList>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) {
      return E.left(new Error('User not authenticated'));
    }

    let query = this.client
      .from('products')
      .select(
        `
      *,
      product_categories (
        categories (
          *
        )
      )
      `
      )
      .eq('auth_user_id', user.id)
      .order('id', { ascending: true });

    if (search && search.trim().length > 0) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      return E.left(error);
    }

    const entities = (data as ProductEntity[]).map((item) => ({
      ...item,
      product_categories:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (item as any).product_categories?.map(
          (pc: { categories: unknown }) => pc.categories
        ) ?? [],
    })) as ProductEntity[];

    return E.right(ProductListMapper.toDomain(entities));
  }

  public async getById(id: string): Promise<E.Either<Error, Product>> {
    const { data, error } = await this.client
      .from('products')
      .select(
        `
    *,
    product_categories (
      categories (
        *
      )
    )
  `
      )
      .eq('id', id)
      .single();

    if (error) {
      return E.left(error);
    }

    const transformedData = {
      ...data,
      product_categories:
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data as any).product_categories?.map(
          (pc: { categories: unknown }) => pc.categories
        ) ?? [],
    };

    const entity = transformedData as ProductEntity;

    return E.right(ProductMapper.toDomain(entity));
  }

  public async create(
    input: CreateProductInput
  ): Promise<E.Either<Error, void>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) {
      return E.left(new Error('User not authenticated'));
    }

    const tenantId = this.tenantStore.getDefaultTenantId();

    const { data, error } = await this.client
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
        tenant_id: tenantId,
        sku: input.sku || null,
        production_cost: input.productionCost ? Number(input.productionCost) : null,
      })
      .select('*');

    if (error) {
      return E.left(new Error(error.message));
    }

    input.categoryIds.forEach(async (categoryId) => {
      await this.client.from('product_categories').insert([
        {
          product_id: data[0].id,
          category_id: categoryId,
        },
      ]);
    });
    return E.right(undefined);
  }

  public async update(
    input: UpdateProductInput
  ): Promise<E.Either<Error, void>> {
    const { data, error } = await this.client
      .from('products')
      .update({
        name: input.name,
        description: input.description,
        price: input.price,
        price_promotional:
          input.pricePromotional.length === 0 ? null : input.pricePromotional,
        photos: input.photos,
        stock: input.stock,
        sku: input.sku || null,
        production_cost: input.productionCost ? Number(input.productionCost) : null,
      })
      .eq('id', input.id)
      .select('*');

    if (error) {
      return E.left(new Error(error.message));
    }

    input.categoryIds.forEach(async (categoryId) => {
      await this.client.from('product_categories').insert([
        {
          product_id: data[0].id,
          category_id: categoryId,
        },
      ]);
    });
    return E.right(undefined);
  }

  public async delete(id: string): Promise<E.Either<Error, void>> {
    const { error } = await this.client.from('products').delete().eq('id', id);

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }

  public async deleteMany(ids: string[]): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('products')
      .delete()
      .in('id', ids);

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }
}
