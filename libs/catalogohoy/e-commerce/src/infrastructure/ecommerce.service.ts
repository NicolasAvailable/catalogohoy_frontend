import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import {
  Product,
  ProductListMapper,
  ProductMapper,
} from '@catalogohoy/product';
import { E } from '@shared/domain';
import { CatalogTemplate, DEFAULT_SOCIAL_LINKS, SocialLinks } from '@catalogohoy/ecommerce-config';
import {
  BaseEcommerceService,
  CatalogInfo,
  Category,
  PaginatedProductList,
  PublicCatalogData,
} from '../domain';

@Injectable({
  providedIn: 'root',
})
export class EcommerceService implements BaseEcommerceService {
  private readonly client = SupabaseClientProvider.getInstance();

  /**
   * Single RPC call that returns all public catalog data:
   * tenant info, ecommerce config, payment methods, business hours,
   * categories, exchange rate, and plan status.
   *
   * Replaces: getCatalogInfo + getCategories + getExchangeRate + checkExpiredBySlug
   */
  public async getPublicCatalog(
    slug: string
  ): Promise<E.Either<Error, PublicCatalogData>> {
    const { data, error } = await this.client.rpc('get_public_catalog', {
      p_slug: slug,
    });

    if (error) {
      return E.left(new Error(error.message));
    }

    if (!data || data.error) {
      return E.left(new Error(data?.error ?? 'Catálogo no encontrado'));
    }

    const config = data.config;
    const hours = data.business_hours;

    // Calcular si está abierto ahora
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;

    let isOpen = config?.is_accepting_orders ?? true;
    let openTime = '08:00';
    let closeTime = '20:00';

    if (hours) {
      openTime = hours.open_time || '08:00';
      closeTime = hours.close_time || '20:00';
      isOpen =
        hours.is_open && currentTime >= openTime && currentTime <= closeTime;
    }

    // Calcular tasa de cambio activa
    let exchangeRate = 0;
    const er = data.exchange_rate;
    if (er) {
      const rateMap: Record<string, number> = {
        bcv_usd: er.bcv_usd ?? 0,
        bcv_eur: er.bcv_eur ?? 0,
        custom: er.custom_rate ?? 0,
      };
      exchangeRate = rateMap[er.active_rate] ?? 0;
    }

    const catalogInfo: CatalogInfo = {
      id: data.tenant.id,
      name: data.tenant.name,
      description: config?.description ?? null,
      logo: config?.logo ?? null,
      banner: config?.banner ?? null,
      whatsappButtons: Array.isArray(config?.whatsapp_buttons)
        ? config.whatsapp_buttons.filter(
            (b: { name?: string; number?: string }) =>
              b.name?.trim() && b.number?.trim()
          )
        : [],
      openTime,
      closeTime,
      isOpen,
      themeColor: config?.theme_color ?? '#10b981',
      showDesignSection: config?.show_design_section ?? true,
      paymentMethods: (data.payment_methods ?? []).map((pm: any) => ({
        id: pm.id,
        tenantId: pm.tenant_id,
        name: pm.name,
        icon: pm.icon,
        isActive: pm.is_active,
        createdAt: pm.created_at,
      })),
      showPaymentMethodsSection:
        config?.show_payment_methods_section ?? true,
      socialLinks: (config?.social_links as SocialLinks) ?? DEFAULT_SOCIAL_LINKS,
      template: (config?.template as CatalogTemplate) ?? 'banner-centered',
      currencySymbol: config?.currency_symbol ?? '$',
      showReferencePrice: config?.show_reference_price ?? true,
      showLocalCurrencyPrice: config?.show_local_currency_price ?? true,
      whatsappOrderMessage: config?.whatsapp_order_message ?? null,
    };

    const categories: Category[] = (data.categories ?? []).map((cat: any) => ({
      id: String(cat.id),
      name: cat.name,
    }));

    return E.right({
      catalogInfo,
      categories,
      exchangeRate,
      planExpired: data.plan?.plan_expired ?? false,
      isFreePlan: data.plan?.is_free ?? true,
    });
  }

  public async getCatalogInfo(
    slug: string
  ): Promise<E.Either<Error, CatalogInfo>> {
    const result = await this.getPublicCatalog(slug);
    return result.mapRight((d) => d.catalogInfo);
  }

  public async getProducts(
    slug: string,
    search?: string,
    categoryId?: string,
    orderBy?: 'name' | 'price_asc' | 'price_desc',
    page = 1,
    pageSize = 20,
    tenantId?: string
  ): Promise<E.Either<Error, PaginatedProductList>> {
    // Use provided tenantId or look it up by slug
    let resolvedTenantId = tenantId;
    if (!resolvedTenantId) {
      const { data: tenant, error: tenantError } = await this.client
        .from('tenants')
        .select('id')
        .eq('slug', slug)
        .single();

      if (tenantError) return E.left(tenantError);
      resolvedTenantId = tenant.id;
    }

    let selectQuery = `
      *,
      product_categories (
        categories (*)
      )
    `;

    if (categoryId) {
      selectQuery = `
        *,
        product_categories!inner (
          category_id,
          categories (*)
        )
      `;
    }

    let query = this.client
      .from('products')
      .select(selectQuery, { count: 'exact' })
      .eq('tenant_id', resolvedTenantId);

    if (search && search.trim().length > 0) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    if (categoryId) {
      query = query.eq('product_categories.category_id', categoryId);
    }

    switch (orderBy) {
      case 'name':
        query = query.order('name', { ascending: true });
        break;
      case 'price_asc':
        query = query.order('price', { ascending: true });
        break;
      case 'price_desc':
        query = query.order('price', { ascending: false });
        break;
      default:
        query = query.order('position', { ascending: true });
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    query = query.range(from, to);

    const { data, error, count } = await query;

    if (error) {
      return E.left(error);
    }

    const entities = (data as any[]).map((item) => ({
      ...item,
      product_categories:
        item.product_categories?.map((pc: any) => pc.categories) ?? [],
    }));

    return E.right({
      productList: ProductListMapper.toDomain(entities),
      totalCount: count ?? 0,
    });
  }

  public async getProductById(id: string): Promise<E.Either<Error, Product>> {
    const { data, error } = await this.client
      .from('products')
      .select(
        `
        *,
        product_categories (
          categories (*)
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
        (data as any).product_categories?.map((pc: any) => pc.categories) ?? [],
    };

    return E.right(ProductMapper.toDomain(transformedData));
  }

  public async getCategories(
    slug: string
  ): Promise<E.Either<Error, Category[]>> {
    const result = await this.getPublicCatalog(slug);
    return result.mapRight((d) => d.categories);
  }

  private async deductStock(
    products: { productId: string; quantity: number }[]
  ): Promise<void> {
    const grouped = products.reduce<Record<string, number>>((acc, item) => {
      acc[item.productId] = (acc[item.productId] ?? 0) + item.quantity;
      return acc;
    }, {});

    for (const [productId, totalQuantity] of Object.entries(grouped)) {
      const { data: product } = await this.client
        .from('products')
        .select('stock')
        .eq('id', productId)
        .single();

      if (product && product.stock !== null) {
        const currentStock = Number(product.stock);
        const newStock = Math.max(0, currentStock - totalQuantity);
        await this.client
          .from('products')
          .update({ stock: newStock })
          .eq('id', productId);
      }
    }
  }

  public async getExchangeRate(): Promise<number> {
    const { data, error } = await this.client
      .from('exchange_rates')
      .select('bcv_usd, bcv_eur, custom_rate, active_rate')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return 0;
    }

    const rateMap: Record<string, number> = {
      bcv_usd: data.bcv_usd ?? 0,
      bcv_eur: data.bcv_eur ?? 0,
      custom: data.custom_rate ?? 0,
    };

    return rateMap[data.active_rate] ?? 0;
  }

  public async createOrder(order: {
    tenant_id: number;
    name: string;
    products: any[];
    total_usd: number;
    phone: string;
    comments: string;
    payment_method?: string;
  }): Promise<E.Either<Error, void>> {
    const exchangeRate = await this.getExchangeRate();
    const totalBs = order.total_usd * exchangeRate;

    const { error } = await this.client.from('orders').insert([
      {
        tenant_id: order.tenant_id,
        name: order.name,
        products: order.products,
        total_usd: order.total_usd,
        total_bs: totalBs,
        phone: order.phone,
        comments: order.comments,
        payment_method: order.payment_method ?? null,
        status: 'pending',
      },
    ]);

    if (error) {
      return E.left(new Error(error.message));
    }

    await this.deductStock(order.products);

    return E.right(undefined);
  }
}
