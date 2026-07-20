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

/** Normalises a form size (string stock) to the persisted shape. */
const mapSize = (s: { name: string; stock: string | null; sku?: string | null }) => ({
  name: s.name,
  stock: s.stock === null || s.stock === '' ? null : Number(s.stock),
  sku: s.sku?.trim() ? s.sku.trim() : null,
});

@Injectable({
  providedIn: 'root',
})
export class ProductService implements BaseProductService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly activityLog = inject(ActivityLogService);
  private readonly htmlSanitizer = inject(HtmlSanitizerService);

  /** True when a product falls outside the free-plan visible window — i.e. its
   *  rank among non-hidden products (ordered by `position`, same as the catalog)
   *  is >= the free-plan cap. Used to block editing a locked product reached via
   *  a direct URL. `cap <= 0` means unlimited → never locked. */
  public async isLockedByFreePlan(
    productId: string,
    cap: number
  ): Promise<boolean> {
    if (cap <= 0) return false;
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return false;

    const { data: target } = await this.client
      .from('products')
      .select('position, is_hidden')
      .eq('id', productId)
      .single();
    // Hidden products aren't part of the visible window, so they're never the
    // ones the cap locks (the owner can still manage them normally).
    if (!target || target.is_hidden) return false;

    const { count } = await this.client
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('is_hidden', false)
      .lt('position', target.position);

    return (count ?? 0) >= cap;
  }

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
      // Busca contra search_blob (columna generada en la DB): nombre +
      // descripción + SKU top-level + nombre/SKU de cada talla y variante. Un
      // solo input del listado cubre todo, sin que el usuario elija el campo.
      query = query.ilike('search_blob', `%${search.trim()}%`);
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
        is_wholesale:
          input.isSized || input.isVariant ? false : input.isWholesale ?? false,
        wholesale_tiers:
          !input.isSized && !input.isVariant && input.isWholesale
            ? input.wholesaleTiers.map((t) => ({
                title: t.title,
                price: Number(t.price),
              }))
            : [],
        is_sold_out: input.isSoldOut ?? false,
        is_hidden: input.isHidden ?? false,
        is_sized: input.isSized ?? false,
        sizes: input.isSized ? input.sizes.map(mapSize) : [],
        is_variant: input.isVariant ?? false,
        variants: input.isVariant
          ? input.variants.map((v) => ({
              id: v.id || crypto.randomUUID(),
              name: v.name,
              price: v.price === '' ? 0 : Number(v.price),
              originalPrice:
                v.originalPrice === '' ? 0 : Number(v.originalPrice),
              sku: v.sku?.trim() ? v.sku.trim() : null,
              photos: v.photos ?? [],
              sizes: (v.sizes ?? []).map(mapSize),
            }))
          : [],
        addons: (input.addons ?? []).map((a) => ({
          id: a.id || crypto.randomUUID(),
          name: a.name,
          price: a.price === '' ? 0 : Number(a.price),
          photo: a.photo ?? null,
          isDefault: !!a.isDefault,
        })),
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
      is_wholesale:
        input.isSized || input.isVariant ? false : input.isWholesale ?? false,
      wholesale_tiers:
        !input.isSized && !input.isVariant && input.isWholesale
          ? input.wholesaleTiers.map((t) => ({
              title: t.title,
              price: Number(t.price),
            }))
          : [],
      is_sold_out: input.isSoldOut ?? false,
      is_hidden: input.isHidden ?? false,
      is_sized: input.isSized ?? false,
      sizes: input.isSized ? input.sizes.map(mapSize) : [],
      is_variant: input.isVariant ?? false,
      variants: input.isVariant
        ? input.variants.map((v) => ({
            id: v.id || crypto.randomUUID(),
            name: v.name,
            price: v.price === '' ? 0 : Number(v.price),
            originalPrice: v.originalPrice === '' ? 0 : Number(v.originalPrice),
            sku: v.sku?.trim() ? v.sku.trim() : null,
            photos: v.photos ?? [],
            sizes: (v.sizes ?? []).map(mapSize),
          }))
        : [],
      addons: (input.addons ?? []).map((a) => ({
        id: a.id || crypto.randomUUID(),
        name: a.name,
        price: a.price === '' ? 0 : Number(a.price),
        photo: a.photo ?? null,
        isDefault: !!a.isDefault,
      })),
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

  /** Busca un producto EXISTENTE del tenant para el import (upsert). Primero por
   *  SKU (si viene), si no por nombre exacto. Devuelve el id o null. Permite que
   *  re-importar la lista ACTUALICE en vez de fallar por SKU duplicado. */
  public async findProductIdForImport(
    sku: string | null,
    name: string
  ): Promise<string | null> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return null;

    const trimmedSku = sku?.trim();
    if (trimmedSku) {
      const { data } = await this.client
        .from('products')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('sku', trimmedSku)
        .limit(1)
        .maybeSingle();
      if (data?.id) return String(data.id);
    }

    const trimmedName = name?.trim();
    if (trimmedName) {
      // Case-insensitive y tolerante a espacios al final (los nombres
      // importados de Excel suelen traer trailing spaces en la DB). Se traen
      // candidatos por prefijo y se verifica igualdad exacta tras trim.
      const pattern = trimmedName.replace(/[\\%_]/g, (m) => `\\${m}`);
      const { data } = await this.client
        .from('products')
        .select('id, name')
        .eq('tenant_id', tenantId)
        .ilike('name', `${pattern}%`)
        .limit(10);
      const match = (data ?? []).find(
        (p) =>
          String(p.name ?? '')
            .trim()
            .toLowerCase() === trimmedName.toLowerCase()
      );
      if (match?.id) return String(match.id);
    }

    return null;
  }

  /** Claves de matching del import (SKUs y nombres del tenant, normalizados)
   *  en una consulta paginada — permite pre-contar los productos NUEVOS de un
   *  Excel sin hacer un SELECT por fila. */
  public async listImportKeys(): Promise<{
    skus: Set<string>;
    names: Set<string>;
  }> {
    const skus = new Set<string>();
    const names = new Set<string>();
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return { skus, names };

    // Paginado: Supabase capea cada SELECT a 1000 filas.
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await this.client
        .from('products')
        .select('sku, name')
        .eq('tenant_id', tenantId)
        .range(from, from + pageSize - 1);
      if (error || !data?.length) break;
      for (const r of data) {
        if (r.sku) skus.add(String(r.sku).trim().toLowerCase());
        if (r.name) names.add(String(r.name).trim().toLowerCase());
      }
      if (data.length < pageSize) break;
    }
    return { skus, names };
  }

  /** Actualización PARCIAL desde el import: solo toca los campos del Excel
   *  (nombre/descripción/precio/promo/stock/sku/costo) + categorías. Preserva a
   *  propósito fotos, variantes, tallas, mayoreo y adicionales — que el Excel no
   *  trae y no queremos borrar al re-importar. */
  public async updateFromImport(
    id: string,
    input: {
      name: string;
      description: string | null;
      price: string;
      pricePromotional: string;
      stock: string | null;
      sku: string | null;
      productionCost: string | null;
      categoryIds: string[];
    }
  ): Promise<E.Either<Error, void>> {
    const payload: Record<string, unknown> = {
      name: input.name,
      price: input.price === '' ? 0 : input.price,
      price_promotional:
        !input.pricePromotional || input.pricePromotional.length === 0
          ? null
          : input.pricePromotional,
      stock: input.stock,
      sku: input.sku || null,
      production_cost: input.productionCost
        ? Number(input.productionCost)
        : null,
    };
    // La descripción solo se pisa si el Excel trae una: una columna vacía no
    // debe borrar la descripción enriquecida en la app.
    if (input.description && input.description.trim()) {
      payload['description'] = this.htmlSanitizer.sanitizeRichText(
        input.description
      );
    }

    const { error } = await this.client
      .from('products')
      .update(payload)
      .eq('id', id);

    if (error) {
      return E.left(new Error(error.message));
    }

    // Categorías: solo se reemplazan si el Excel trae alguna — una columna
    // vacía no debe quitar las categorías ya asignadas.
    if (input.categoryIds.length > 0) {
      await this.client
        .from('product_categories')
        .delete()
        .eq('product_id', id);
      for (const categoryId of input.categoryIds) {
        await this.client
          .from('product_categories')
          .insert({ product_id: id, category_id: categoryId });
      }
    }

    this.activityLog.log({
      action: 'product.update',
      entityType: 'product',
      entityId: Number(id),
      entityName: input.name,
    });

    return E.right(undefined);
  }

  /** Duplica un producto: inserta una nueva fila con los mismos campos +
   *  sufijo "(copia)" en el nombre, posición al final, y re-linkea las
   *  categorías al nuevo id. Todo lo que vive en la fila (sizes, wholesale
   *  tiers, photos, flags) se copia tal cual — son columnas JSON, no FK. */
  public async duplicate(id: string): Promise<E.Either<Error, string>> {
    const {
      data: { user },
    } = await this.client.auth.getUser();
    if (!user) {
      return E.left(new Error('User not authenticated'));
    }

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      return E.left(new Error('No tenant found'));
    }

    const { data: src, error: srcErr } = await this.client
      .from('products')
      .select('*')
      .eq('id', id)
      .single();
    if (srcErr || !src) {
      return E.left(new Error(srcErr?.message ?? 'Producto no encontrado'));
    }

    const { data: maxData } = await this.client
      .from('products')
      .select('position')
      .eq('tenant_id', tenantId)
      .order('position', { ascending: false })
      .limit(1)
      .single();
    const nextPosition = (maxData?.position ?? -1) + 1;

    const { id: _omitId, created_at: _omitCreated, updated_at: _omitUpdated, ...rest } = src;
    void _omitId; void _omitCreated; void _omitUpdated;

    const { data: inserted, error: insErr } = await this.client
      .from('products')
      .insert({
        ...rest,
        name: `${src.name} (copia)`,
        auth_user_id: user.id,
        tenant_id: tenantId,
        position: nextPosition,
        is_hidden: true,
      })
      .select('id, name')
      .single();
    if (insErr || !inserted) {
      return E.left(new Error(insErr?.message ?? 'No se pudo duplicar'));
    }

    const { data: cats } = await this.client
      .from('product_categories')
      .select('category_id')
      .eq('product_id', id);
    if (cats && cats.length > 0) {
      await this.client.from('product_categories').insert(
        cats.map((c) => ({
          product_id: inserted.id,
          category_id: c.category_id,
        }))
      );
    }

    this.activityLog.log({
      action: 'product.create',
      entityType: 'product',
      entityId: inserted.id,
      entityName: inserted.name,
    });

    return E.right(String(inserted.id));
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
