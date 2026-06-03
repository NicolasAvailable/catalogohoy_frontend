import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import {
  Product,
  ProductListMapper,
  ProductMapper,
} from '@catalogohoy/product';
import { E } from '@shared/domain';
import {
  CatalogTemplate,
  DEFAULT_SOCIAL_LINKS,
  ExchangeRateType,
  SocialLinks,
  TenantCurrencyConfig,
} from '@catalogohoy/ecommerce-config';
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

    // Fetch the full week of business hours for the schedule modal.
    const { data: weekHoursData } = await this.client
      .from('tenant_business_hours')
      .select('day_of_week, open_time, close_time, is_open')
      .eq('tenant_id', data.tenant.id)
      .order('day_of_week', { ascending: true });

    const businessHoursWeek = (weekHoursData ?? []).map((h: {
      day_of_week: number;
      open_time: string;
      close_time: string;
      is_open: boolean;
    }) => ({
      dayOfWeek: h.day_of_week,
      openTime: h.open_time,
      closeTime: h.close_time,
      isOpen: h.is_open,
    }));

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
      // When close > open the window is same-day (08:00–20:00).
      // When close <= open the window crosses midnight (18:00–02:00,
      // or 08:00–00:00 = "until midnight"). Equal times mean 24h open.
      const isInWindow =
        closeTime > openTime
          ? currentTime >= openTime && currentTime <= closeTime
          : currentTime >= openTime || currentTime <= closeTime;
      isOpen = hours.is_open && isInWindow;
    }

    // Calcular tasa de cambio activa.
    //
    // IMPORTANTE: el tipo de tasa activa y la custom_rate son PER-TENANT
    // (se setean en "Tasas del día" → tabla tenant_currency_config). El RPC
    // devuelve `exchange_rate.active_rate` desde la fila global singleton
    // de `exchange_rates`, que NO es lo que el tenant eligió. Por eso
    // leemos siempre desde `currency_config` (que sí viene per-tenant en
    // la misma respuesta del RPC) y caemos al global solo como último
    // recurso si el tenant aún no tiene config.
    const er = data.exchange_rate;
    const cc = data.currency_config;
    let exchangeRate = 0;
    if (er) {
      const activeRate: string =
        cc?.exchange_rate_type && cc.exchange_rate_type !== 'none'
          ? cc.exchange_rate_type
          : er.active_rate ?? 'bcv_usd';
      const rateMap: Record<string, number> = {
        bcv_usd: er.bcv_usd ?? 0,
        bcv_eur: er.bcv_eur ?? 0,
        custom: cc?.custom_rate ?? er.custom_rate ?? 0,
      };
      exchangeRate = rateMap[activeRate] ?? 0;
    }

    const currencyConfig: TenantCurrencyConfig | null = cc
      ? {
          productCurrency: cc.product_currency ?? 'USD',
          displayCurrency: cc.display_currency ?? 'USD',
          exchangeRateType: (cc.exchange_rate_type as ExchangeRateType) ?? 'none',
          customRate: cc.custom_rate ?? null,
          showDualCurrency: cc.show_dual_currency ?? false,
          currencySymbol: cc.currency_symbol ?? '$',
          decimalSeparator: cc.decimal_separator ?? ',',
          thousandSeparator: cc.thousand_separator ?? '.',
        }
      : null;

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
      businessHoursWeek,
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
      country: data.tenant.country ?? null,
      countryCode: data.tenant.country_code ?? null,
      state: config?.state ?? null,
      city: config?.city ?? null,
      showLocationSection: config?.show_location_section ?? true,
      showCategoriesSection: config?.show_categories_section ?? true,
      currencyConfig,
    };

    const categories: Category[] = (data.categories ?? []).map((cat: any) => ({
      id: String(cat.id),
      name: cat.name,
      isViewAll: cat.is_view_all ?? false,
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
      .eq('tenant_id', resolvedTenantId)
      .eq('is_hidden', false);

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

  /** Descuenta stock vía RPC `decrement_product_stock` (SECURITY DEFINER).
   *  El UPDATE directo client-side fallaba en silencio cuando lo disparaba
   *  un visitante anónimo: la RLS de `products` solo permite UPDATE a
   *  miembros autenticados del tenant. La RPC bypassa eso de forma segura,
   *  validando tenant_id por cada item y soportando productos con sizes. */
  private async deductStock(
    tenantId: number,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: any[]
  ): Promise<void> {
    if (!items?.length) return;
    const payload = items.map((it) => ({
      productId: it.productId,
      quantity: it.quantity,
      size: it.size ?? null,
    }));
    const { error } = await this.client.rpc('decrement_product_stock', {
      p_tenant_id: tenantId,
      p_items: payload,
    });
    if (error) {
      console.warn('[decrement_product_stock] failed', error);
    }
  }

  public async getExchangeRate(tenantId?: number | string): Promise<number> {
    const { data: global, error } = await this.client
      .from('exchange_rates')
      .select('bcv_usd, bcv_eur')
      .eq('id', 1)
      .maybeSingle();

    if (error || !global) {
      return 0;
    }

    // The active rate type and custom rate are per-tenant (set in
    // Tasas del día). Without a tenantId we can't know the selection,
    // so fall back to BCV USD to avoid silently using a stale global value.
    let activeRate = 'bcv_usd';
    let customRate = 0;
    if (tenantId !== undefined) {
      const { data: tenant } = await this.client
        .from('tenant_currency_config')
        .select('exchange_rate_type, custom_rate')
        .eq('tenant_id', Number(tenantId))
        .maybeSingle();

      if (tenant?.exchange_rate_type) {
        activeRate = tenant.exchange_rate_type;
      }
      customRate = tenant?.custom_rate ?? 0;
    }

    const rateMap: Record<string, number> = {
      bcv_usd: global.bcv_usd ?? 0,
      bcv_eur: global.bcv_eur ?? 0,
      custom: customRate,
    };

    return rateMap[activeRate] ?? 0;
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
    const exchangeRate = await this.getExchangeRate(order.tenant_id);
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

    await this.deductStock(order.tenant_id, order.products);

    return E.right(undefined);
  }
}
