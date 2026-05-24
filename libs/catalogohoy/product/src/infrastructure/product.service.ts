import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { ActivityLogService } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import { HtmlSanitizerService } from '@shared/infrastructure';
import {
  BaseProductService,
  CreateProductInput,
  Product,
  ProductList,
  ReplaceCategoriesInput,
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
  private readonly activityLog = inject(ActivityLogService);
  private readonly htmlSanitizer = inject(HtmlSanitizerService);

  public async getAll(
    page?: number,
    pageSize?: number,
    search?: string
  ): Promise<E.Either<Error, ProductList>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      return E.left(new Error('No tenant found'));
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
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true });

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

    const tenantId = await this.tenantStore.getTenantIdAsync();

    // Get next position for this tenant
    const { data: maxData } = await this.client
      .from('products')
      .select('position')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: false })
      .limit(1)
      .single();

    const nextPosition = (maxData?.position ?? -1) + 1;

    const { data, error } = await this.client
      .from('products')
      .insert({
        name: input.name,
        description: this.htmlSanitizer.sanitizeRichText(input.description),
        price: input.price === '' ? 0 : input.price,
        price_promotional:
          !input.pricePromotional || input.pricePromotional.length === 0 ? null : input.pricePromotional,
        photos: input.photos,
        auth_user_id: user.id,
        stock: input.stock,
        tenant_id: tenantId,
        sku: input.sku || null,
        production_cost: input.productionCost ? Number(input.productionCost) : null,
        position: nextPosition,
        is_wholesale: input.isSized ? false : input.isWholesale ?? false,
        wholesale_tiers:
          !input.isSized && input.isWholesale
            ? input.wholesaleTiers.map((t) => ({
                title: t.title,
                price: Number(t.price),
              }))
            : [],
        is_sold_out: input.isSoldOut ?? false,
        is_hidden: input.isHidden ?? false,
        is_sized: input.isSized ?? false,
        sizes: input.isSized
          ? input.sizes.map((s) => ({
              name: s.name,
              stock: s.stock === null || s.stock === '' ? null : Number(s.stock),
            }))
          : [],
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

    this.activityLog.log({
      action: 'product.create',
      entityType: 'product',
      entityId: data[0].id,
      entityName: input.name,
    });

    return E.right(undefined);
  }

  public async update(
    input: UpdateProductInput
  ): Promise<E.Either<Error, void>> {
    // Snapshot the current state BEFORE update for diff.
    const { data: before } = await this.client
      .from('products')
      .select('name, description, price, price_promotional, stock, sku, production_cost, is_wholesale, is_sold_out, is_hidden, position')
      .eq('id', input.id)
      .single();

    const updatePayload: Record<string, unknown> = {
      name: input.name,
      description: this.htmlSanitizer.sanitizeRichText(input.description),
      price: input.price === '' ? 0 : input.price,
      price_promotional:
        !input.pricePromotional || input.pricePromotional.length === 0 ? null : input.pricePromotional,
      photos: input.photos,
      stock: input.stock,
      sku: input.sku || null,
      production_cost: input.productionCost ? Number(input.productionCost) : null,
      is_wholesale: input.isSized ? false : input.isWholesale ?? false,
      wholesale_tiers:
        !input.isSized && input.isWholesale
          ? input.wholesaleTiers.map((t) => ({
              title: t.title,
              price: Number(t.price),
            }))
          : [],
      is_sold_out: input.isSoldOut ?? false,
      is_hidden: input.isHidden ?? false,
      is_sized: input.isSized ?? false,
      sizes: input.isSized
        ? input.sizes.map((s) => ({
            name: s.name,
            stock: s.stock === null || s.stock === '' ? null : Number(s.stock),
          }))
        : [],
    };

    if (input.position !== undefined) {
      updatePayload['position'] = input.position;
    }

    const { data, error } = await this.client
      .from('products')
      .update(updatePayload)
      .eq('id', input.id)
      .select('*');

    if (error) {
      return E.left(new Error(error.message));
    }

    const { error: deleteError } = await this.client
      .from('product_categories')
      .delete()
      .eq('product_id', data[0].id);

    if (deleteError) {
      return E.left(new Error(deleteError.message));
    }

    for (const categoryId of input.categoryIds) {
      await this.client.from('product_categories').insert({
        product_id: data[0].id,
        category_id: categoryId,
      });
    }

    // Log the diff (fire-and-forget)
    if (before) {
      const changes = this.activityLog.diff(
        {
          name: before.name,
          price: before.price,
          pricePromotional: before.price_promotional,
          stock: before.stock,
          sku: before.sku,
          isSoldOut: before.is_sold_out,
          isHidden: before.is_hidden,
          position: before.position,
        },
        {
          name: input.name,
          price: input.price === '' ? 0 : Number(input.price),
          pricePromotional: !input.pricePromotional || input.pricePromotional.length === 0 ? null : Number(input.pricePromotional),
          stock: input.stock,
          sku: input.sku || null,
          isSoldOut: input.isSoldOut ?? false,
          isHidden: input.isHidden ?? false,
          position: input.position,
        }
      );
      if (changes.length > 0) {
        this.activityLog.log({
          action: 'product.update',
          entityType: 'product',
          entityId: Number(input.id),
          entityName: input.name,
          changes,
        });
      }
    }

    return E.right(undefined);
  }

  public async delete(id: string): Promise<E.Either<Error, void>> {
    // Snapshot the name for the log before we lose the row.
    const { data: snap } = await this.client
      .from('products')
      .select('name')
      .eq('id', id)
      .single();

    const { error } = await this.client.from('products').delete().eq('id', id);

    if (error) {
      return E.left(new Error(error.message));
    }

    this.activityLog.log({
      action: 'product.delete',
      entityType: 'product',
      entityId: Number(id),
      entityName: snap?.name ?? null,
    });

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

  public async replaceCategories(
    input: ReplaceCategoriesInput
  ): Promise<E.Either<Error, void>> {
    for (const productId of input.productIds) {
      const { error: deleteError } = await this.client
        .from('product_categories')
        .delete()
        .eq('product_id', productId);

      if (deleteError) {
        return E.left(new Error(deleteError.message));
      }

      for (const categoryId of input.categoryIds) {
        const { error: insertError } = await this.client
          .from('product_categories')
          .insert({ product_id: productId, category_id: categoryId });

        if (insertError) {
          return E.left(new Error(insertError.message));
        }
      }
    }
    return E.right(undefined);
  }

  public async updatePositions(
    products: Product[]
  ): Promise<E.Either<Error, void>> {
    const updates = products.map((product, index) =>
      this.client
        .from('products')
        .update({ position: index })
        .eq('id', product.id)
    );

    await Promise.all(updates);
    return E.right(undefined);
  }
}
