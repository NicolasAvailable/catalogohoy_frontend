import { inject, Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import {
  BaseCategoryService,
  Category,
  CategoryListPage,
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
  ): Promise<E.Either<Error, CategoryListPage>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      return E.left(new Error('No tenant found'));
    }

    // Request `count: 'exact'` so we get the total number of categories
    // for this tenant alongside the paginated rows — needed by the
    // paginator UI to compute totalRecords / page count.
    let query = this.client
      .from('categories')
      .select('*', { count: 'exact' })
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true });

    if (page !== undefined && pageSize !== undefined) {
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);
    }

    const { data, count, error } = await query;

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right({
      list: CategoryListMapper.toDomain(data as CategoryEntity[]),
      total: count ?? 0,
    });
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

  private async getTenantId(userId: string): Promise<number | null> {
    // Obtener user.id de la tabla users
    const { data: userData } = await this.client
      .from('users')
      .select('id')
      .eq('auth_user_id', userId)
      .maybeSingle();

    if (!userData) {
      return null;
    }

    // Intentar obtener tenant con is_default=true
    let { data: tenantData } = await this.client
      .from('users_tenants')
      .select('tenant_id')
      .eq('user_id', userData.id)
      .eq('is_default', true)
      .maybeSingle();

    // Si no hay tenant por defecto, obtener el primero disponible
    if (!tenantData) {
      const { data: firstTenant } = await this.client
        .from('users_tenants')
        .select('tenant_id')
        .eq('user_id', userData.id)
        .limit(1)
        .maybeSingle();

      tenantData = firstTenant;
    }

    return tenantData?.tenant_id ?? null;
  }

  public async create(
    input: CreateCategoryInput
  ): Promise<E.Either<Error, void>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();

    if (!user) {
      return E.left(new Error('User not authenticated'));
    }

    const tenantId = await this.tenantStore.getTenantIdAsync();

    // Get the last position
    const { data: maxPosData } = await this.client
      .from('categories')
      .select('position')
      .eq('tenant_id', tenantId)
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
        auth_user_id: user.id,
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
    categories: Category[],
    offset = 0
  ): Promise<E.Either<Error, void>> {
    // `offset` is the global index of the first item in the current page,
    // so when reordering page 2 (offset=10) the items get positions
    // 10, 11, 12, … instead of 0, 1, 2, … which would clobber page 1.
    const updates = categories.map((cat, index) =>
      this.client
        .from('categories')
        .update({ position: offset + index })
        .eq('id', cat.id)
    );

    await Promise.all(updates);
    return E.right(undefined);
  }

  /**
   * Moves a single category to an arbitrary global position (1-based).
   * Loads the full ordered list, splices the moved item, and rewrites
   * every position so the ordering stays contiguous across pages.
   */
  public async moveCategoryToPosition(
    categoryId: number | string,
    newPosition: number
  ): Promise<E.Either<Error, void>> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      return E.left(new Error('No tenant found'));
    }

    const { data, error } = await this.client
      .from('categories')
      .select('id, position')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: true });

    if (error) {
      return E.left(new Error(error.message));
    }

    const all = (data ?? []) as { id: number; position: number }[];
    if (all.length === 0) {
      return E.right(undefined);
    }

    const numericId = Number(categoryId);
    const currentIndex = all.findIndex((c) => c.id === numericId);
    if (currentIndex === -1) {
      return E.left(new Error('Category not found'));
    }

    const targetIndex = Math.max(
      0,
      Math.min(all.length - 1, Math.floor(newPosition) - 1)
    );
    if (currentIndex === targetIndex) {
      return E.right(undefined);
    }

    const [moved] = all.splice(currentIndex, 1);
    all.splice(targetIndex, 0, moved);

    const updates = all.map((cat, index) =>
      this.client
        .from('categories')
        .update({ position: index })
        .eq('id', cat.id)
    );

    await Promise.all(updates);
    return E.right(undefined);
  }
}
