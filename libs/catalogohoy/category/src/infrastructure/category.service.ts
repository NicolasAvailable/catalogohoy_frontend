import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import {
  BaseCategoryService,
  Category,
  CategoryList,
  CreateCategoryInput,
  UpdateCategoryInput,
} from '../domain';
import { CategoryEntity } from './entities';
import { CategoryListMapper } from './mappers';

@Injectable({
  providedIn: 'root',
})
export class CategoryService implements BaseCategoryService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  public async getAll(
    page?: number,
    pageSize?: number
  ): Promise<E.Either<Error, CategoryList>> {
    const authUserId = this.tenantStore.getAuthUserId();

    if (!authUserId) {
      return E.left(new Error('User not authenticated'));
    }

    let query = this.client
      .from('categories')
      .select('*')
      .eq('auth_user_id', authUserId)
      .order('position', { ascending: true });

    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(CategoryListMapper.toDomain(data as CategoryEntity[]));
  }

  public async getById(id: string): Promise<E.Either<Error, Category>> {
    const { data, error } = await this.client
      .from('categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    const entity = data as CategoryEntity;

    return E.right(
      Category.create({
        id: entity.id,
        name: entity.name,
        description: entity.description,
        isVisible: entity.is_visible,
        position: entity.position,
        authUserId: entity.auth_user_id,
        createdAt: entity.created_at,
      })
    );
  }

  public async create(
    input: CreateCategoryInput
  ): Promise<E.Either<Error, void>> {
    const authUserId = this.tenantStore.getAuthUserId();
    const tenantId = this.tenantStore.getTenantId();

    if (!authUserId) {
      return E.left(new Error('User not authenticated'));
    }

    // Get the last position
    const { data: maxPosData } = await this.client
      .from('categories')
      .select('position')
      .eq('auth_user_id', authUserId)
      .order('position', { ascending: false })
      .limit(1)
      .maybeSingle();

    const newPosition = (maxPosData?.position ?? -1) + 1;

    const { error } = await this.client
      .from('categories')
      .insert({
        name: input.name,
        description: input.description,
        is_visible: input.isVisible,
        position: newPosition,
        auth_user_id: authUserId,
        tenant_id: tenantId,
      })
      .select('*');

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }

  public async update(
    input: UpdateCategoryInput
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('categories')
      .update({
        name: input.name,
        description: input.description,
        is_visible: input.isVisible,
      })
      .eq('id', input.id)
      .select('*');

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }

  public async delete(id: string): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) {
      return E.left(new Error(error.message));
    }
    return E.right(undefined);
  }

  public async updatePositions(
    categories: Category[]
  ): Promise<E.Either<Error, void>> {
    const updates = categories.map((cat, index) =>
      this.client
        .from('categories')
        .update({ position: index })
        .eq('id', cat.id)
    );

    await Promise.all(updates);
    return E.right(undefined);
  }
}
