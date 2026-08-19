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
  CustomerFieldsConfig,
  DEFAULT_CUSTOMER_FIELDS,
  DEFAULT_SOCIAL_LINKS,
  ExchangeRateType,
  findCountryByCode,
  findCurrencyByCode,
  NO_CURRENCY_SYMBOL,
  ShippingMethod,
  ShippingMethodType,
  SocialLinks,
  TenantCurrencyConfig,
} from '@catalogohoy/ecommerce-config';
import {
  BaseEcommerceService,
  CatalogInfo,
  Category,
  PaginatedProductList,
  PublicCatalogData,
  PublicOrder,
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
          // El centinela "sin símbolo" se mapea a '' para que nada downstream
          // renderice el espacio de ancho cero.
          currencySymbol:
            cc.currency_symbol === NO_CURRENCY_SYMBOL
              ? ''
              : cc.currency_symbol ?? '$',
          decimalSeparator: cc.decimal_separator ?? ',',
          thousandSeparator: cc.thousand_separator ?? '.',
        }
      : null;

    // ── Símbolo de moneda del catálogo ──────────────────────────────────────
    // Hay DOS fuentes posibles de símbolo en la respuesta del RPC:
    //   - config.currency_symbol  → de `tenant_ecommerce_config` (suele estar
    //     stale, normalmente '$').
    //   - cc.currency_symbol      → de `tenant_currency_config`, lo que el
    //     tenant elige en "Tasas del día" (autoritativo: Q, S/, R$, €, RD$, Bs.…).
    //
    // ⚠️ CASO ESPECIAL VENEZUELA (country_code === 'VE') — NO TOCAR sin pensar:
    //   En VE el precio BASE que se muestra es la moneda de REFERENCIA ($ o €),
    //   NO la moneda local (Bs.). La línea en Bs. se muestra APARTE y se controla
    //   con el toggle `showLocalCurrencyPrice` (+ `showReferencePrice` para el $).
    //   En VE `cc.currency_symbol` casi siempre es 'Bs.' (la moneda local), así
    //   que si lo usáramos como símbolo base, el precio saldría "Bs.18" aunque el
    //   usuario tenga el Bs. APAGADO y quiera ver solo $. Eso fue un bug real
    //   (catálogo `dicenorepostero`: config '$' + cc 'Bs.' → mostraba 'Bs.'
    //   siempre). Por eso para VE mantenemos la lógica histórica:
    //     config.currency_symbol → derivado del país → '$'.
    //
    // RESTO DE PAÍSES (GT, BR, DO, PE, ES…):
    //   `cc.currency_symbol` es la fuente autoritativa. Usar config primero hacía
    //   que GT/BR/DO… mostraran '$' aunque la moneda fuera GTQ/BRL/DOP.
    const symbolFromCountry = (() => {
      const country = findCountryByCode(data.tenant.country_code);
      const currency = country
        ? findCurrencyByCode(country.defaultCurrency)
        : null;
      return currency?.symbol ?? null;
    })();
    // "Sin símbolo de moneda": el tenant lo activa desde el editor y se persiste
    // como centinela (NO_CURRENCY_SYMBOL) en `currency_symbol`. Se chequea ANTES
    // del split VE/resto para que aplique en cualquier país. La línea en Bs. de
    // VE usa el literal "Bs." aparte, así que no se ve afectada.
    const symbolHidden =
      cc?.currency_symbol === NO_CURRENCY_SYMBOL ||
      config?.currency_symbol === NO_CURRENCY_SYMBOL;
    const currencySymbol = symbolHidden
      ? ''
      : data.tenant.country_code === 'VE'
        ? config?.currency_symbol ?? symbolFromCountry ?? '$'
        : cc?.currency_symbol?.trim() ||
          symbolFromCountry ||
          config?.currency_symbol?.trim() ||
          '$';

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
      defaultLanguage: (config?.default_language as string) ?? 'es',
      showDesignSection: config?.show_design_section ?? true,
      paymentMethods: (data.payment_methods ?? []).map((pm: any) => ({
        id: pm.id,
        tenantId: pm.tenant_id,
        name: pm.name,
        icon: pm.icon,
        isActive: pm.is_active,
        createdAt: pm.created_at,
        details: pm.details ?? {},
      })),
      showPaymentMethodsSection:
        config?.show_payment_methods_section ?? true,
      socialLinks: (config?.social_links as SocialLinks) ?? DEFAULT_SOCIAL_LINKS,
      template: (config?.template as CatalogTemplate) ?? 'banner-centered',
      // Símbolo de moneda (ver el bloque de arriba para la lógica VE vs resto).
      currencySymbol,
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
      shippingMethods: this.normalizeShippingMethods(config?.shipping_methods),
      showShippingSection: config?.show_shipping_section ?? false,
      customerFields:
        (config?.customer_fields as CustomerFieldsConfig) ??
        DEFAULT_CUSTOMER_FIELDS,
      // Delivery-date settings live inside the `customer_fields` jsonb (no
      // dedicated DB column); the RPC returns that column verbatim.
      deliveryDateEnabled:
        (config?.customer_fields as { deliveryDateEnabled?: boolean })
          ?.deliveryDateEnabled ?? false,
      deliveryBlockedWeekdays: Array.isArray(
        (config?.customer_fields as { deliveryBlockedWeekdays?: number[] })
          ?.deliveryBlockedWeekdays
      )
        ? ((config?.customer_fields as { deliveryBlockedWeekdays?: number[] })
            .deliveryBlockedWeekdays as number[])
        : [],
    };

    // El RPC devuelve solo categorías visibles, EXCEPTO la fila "Ver todos"
    // (is_view_all) que viene siempre con su is_visible, para distinguir
    // "no existe" (tenant legacy -> tab sintético) de "el tenant la ocultó"
    // (-> ningún tab de Ver todos, pero se muestran todos los productos).
    const rawCategories: any[] = data.categories ?? [];
    const categories: Category[] = rawCategories
      .filter((cat: any) => cat.is_visible !== false)
      .map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
        isViewAll: cat.is_view_all ?? false,
      }));
    const viewAllHidden = rawCategories.some(
      (cat: any) => (cat.is_view_all ?? false) && cat.is_visible === false
    );

    return E.right({
      catalogInfo,
      categories,
      viewAllHidden,
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
    tenantId?: string,
    // Hard ceiling on how many products the public catalog will serve. Used to
    // enforce the free-plan limit on downgraded tenants: only the first `cap`
    // products (by the default `position` order) are visible; the rest stay in
    // the DB but never reach the storefront. `undefined`/0 = no cap.
    cap?: number
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
      // Igual que el admin: busca contra search_blob (nombre + descripción +
      // SKU top-level + nombre/SKU de tallas y variantes).
      query = query.ilike('search_blob', `%${search.trim()}%`);
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

    const hasCap = cap !== undefined && cap > 0;
    const from = (page - 1) * pageSize;
    let to = from + pageSize - 1;

    // Page fully past the cap → nothing to serve. Report the capped total so the
    // catalog's "load more" stops cleanly at the limit.
    if (hasCap && from >= cap!) {
      return E.right({
        productList: ProductListMapper.toDomain([]),
        totalCount: cap!,
      });
    }
    if (hasCap) {
      to = Math.min(to, cap! - 1);
    }

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

    const totalCount = hasCap
      ? Math.min(count ?? 0, cap!)
      : count ?? 0;

    return E.right({
      productList: ProductListMapper.toDomain(entities),
      totalCount,
    });
  }

  // Cached across the catalog session — the free-plan limit is a global product
  // setting, not per-tenant, so one lookup is enough.
  private freePlanMaxProductsCache: number | null = null;

  public async getFreePlanMaxProducts(): Promise<number> {
    if (this.freePlanMaxProductsCache !== null) {
      return this.freePlanMaxProductsCache;
    }
    const { data } = await this.client
      .from('plans')
      .select('max_products')
      .eq('is_free', true)
      .single();
    const max = data?.max_products ?? 10;
    this.freePlanMaxProductsCache = max;
    return max;
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
      variantId: it.variantId ?? null,
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
    email?: string;
    payment_method?: string;
    shipping_method?: {
      name: string;
      type: 'pickup' | 'delivery' | 'shipping';
      fee: number;
      priceOnRequest?: boolean;
    } | null;
    shipping_address?: string | null;
    shipping_fee?: number;
    /** Customer-chosen delivery date (YYYY-MM-DD). Only sent when the catalog
     *  has the delivery-date feature enabled and the customer picked one; when
     *  omitted the DB uses its default (CURRENT_DATE). */
    delivery_date?: string;
  }): Promise<E.Either<Error, { id: number }>> {
    const exchangeRate = await this.getExchangeRate(order.tenant_id);
    const totalBs = order.total_usd * exchangeRate;

    const { data, error } = await this.client
      .from('orders')
      .insert([
        {
          tenant_id: order.tenant_id,
          name: order.name,
          products: order.products,
          total_usd: order.total_usd,
          total_bs: totalBs,
          phone: order.phone,
          comments: order.comments,
          email: order.email ?? null,
          payment_method: order.payment_method ?? null,
          shipping_method: order.shipping_method ?? null,
          shipping_address: order.shipping_address ?? null,
          shipping_fee: order.shipping_fee ?? 0,
          // Solo se envía cuando el cliente eligió fecha; si es undefined el
          // servidor usa su default (CURRENT_DATE).
          ...(order.delivery_date
            ? { delivery_date: order.delivery_date }
            : {}),
          status: 'pending',
          // Orden del catálogo público: sí dispara notificaciones (WhatsApp/email).
          source: 'public',
        },
      ])
      .select('id')
      .single();

    if (error) {
      return E.left(new Error(error.message));
    }

    // Las órdenes nacen 'pending' — NO descontamos stock aquí. El descuento
    // ocurre cuando el admin marca la orden como 'completed' (ver
    // OrderService.updateOrderStatus). Así una orden cancelada no afecta el
    // inventario y evitamos restaurar stock por cada cancelación.

    return E.right({ id: data.id as number });
  }

  /** Fetch an order by id for the public invoice/receipt. Orders are readable
   *  by anon (RLS `lectura_publica`), so the invoice link is shareable like a
   *  normal receipt — no extra RPC needed. */
  public async getPublicOrder(
    id: number
  ): Promise<E.Either<Error, PublicOrder>> {
    const { data, error } = await this.client
      .from('orders')
      .select(
        'id, order_number, status, name, phone, email, products, total_usd, total_bs, shipping_method, shipping_address, shipping_fee, payment_method, comments, created_at'
      )
      .eq('id', id)
      .single();

    if (error) return E.left(new Error(error.message));
    if (!data) return E.left(new Error('Orden no encontrada'));

    return E.right({
      id: data.id,
      orderNumber: data.order_number ?? null,
      status: data.status ?? 'pending',
      name: data.name ?? '',
      phone: data.phone ?? null,
      email: data.email ?? null,
      products: Array.isArray(data.products)
        ? data.products.map((p: any) => ({
            productId: p.productId,
            name: p.name,
            quantity: Number(p.quantity) || 0,
            price: Number(p.price) || 0,
            total: Number(p.total) || 0,
            size: p.size ?? null,
            sku: p.sku ?? null,
            photo: p.photo,
            addons: Array.isArray(p.addons)
              ? p.addons.map((a: any) => ({
                  id: a.id ?? undefined,
                  name: a.name,
                  price: Number(a.price) || 0,
                  quantity: Number(a.quantity) || 1,
                }))
              : null,
          }))
        : [],
      totalUsd: Number(data.total_usd) || 0,
      totalBs: data.total_bs != null ? Number(data.total_bs) : null,
      shippingMethod: data.shipping_method ?? null,
      shippingAddress: data.shipping_address ?? null,
      shippingFee: Number(data.shipping_fee) || 0,
      paymentMethod: data.payment_method ?? null,
      comments: data.comments ?? null,
      createdAt: data.created_at,
    });
  }

  /** Raw jsonb from the RPC isn't trusted — coerce each shipping method into a
   *  well-formed object so the checkout never crashes on a malformed row. */
  private normalizeShippingMethods(raw: unknown): ShippingMethod[] {
    if (!Array.isArray(raw)) return [];
    const types: ShippingMethodType[] = ['pickup', 'delivery', 'shipping'];
    return raw
      .map((m: any, i: number): ShippingMethod => {
        const type: ShippingMethodType = types.includes(m?.type)
          ? m.type
          : 'pickup';
        return {
          id: String(m?.id ?? `sm_${i}`),
          name: String(m?.name ?? ''),
          type,
          fee: Number(m?.fee) || 0,
          // "A consultar": sin esto el flag se pierde al normalizar la
          // respuesta del RPC y el checkout público muestra "Gratis".
          priceOnRequest: !!m?.priceOnRequest,
          instructions: String(m?.instructions ?? ''),
          requestCustomerAddress: !!m?.requestCustomerAddress,
          address: m?.address ?? null,
          lat: m?.lat != null ? Number(m.lat) : null,
          lng: m?.lng != null ? Number(m.lng) : null,
          isActive: m?.isActive !== false,
          isDefault: !!m?.isDefault,
          position: Number(m?.position) || i,
        };
      })
      .sort((a, b) => a.position - b.position);
  }
}
