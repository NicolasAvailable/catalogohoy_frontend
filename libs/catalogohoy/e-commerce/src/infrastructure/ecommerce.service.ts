import { Injectable } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import {
  Product,
  ProductList,
  ProductListMapper,
  ProductMapper,
} from '@catalogohoy/product';
import { E } from '@shared/domain';
import { BaseEcommerceService, CatalogInfo, Category } from '../domain';

@Injectable({
  providedIn: 'root',
})
export class EcommerceService implements BaseEcommerceService {
  private readonly client = SupabaseClientProvider.getInstance();

  public async getCatalogInfo(
    slug: string
  ): Promise<E.Either<Error, CatalogInfo>> {
    // Obtener información del tenant con su configuración de e-commerce
    const { data: tenant, error: tenantError } = await this.client
      .from('tenants')
      .select('id, name')
      .eq('slug', slug)
      .single();

    if (tenantError) {
      return E.left(tenantError);
    }

    // Obtener configuración de e-commerce
    const { data: config } = await this.client
      .from('tenant_ecommerce_config')
      .select('whatsapp_buttons, logo, is_accepting_orders')
      .eq('tenant_id', tenant.id)
      .single();

    // Obtener horarios del día actual
    const dayOfWeek = new Date().getDay(); // 0=Domingo, 1=Lunes, etc.
    const { data: hours } = await this.client
      .from('tenant_business_hours')
      .select('open_time, close_time, is_open')
      .eq('tenant_id', tenant.id)
      .eq('day_of_week', dayOfWeek)
      .single();

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

    return E.right({
      id: tenant.id,
      name: tenant.name,
      whatsappButtons: Array.isArray(config?.whatsapp_buttons)
        ? config.whatsapp_buttons
        : [],
      openTime,
      closeTime,
      isOpen,
    });
  }

  public async getProducts(
    slug: string,
    search?: string,
    categoryId?: string,
    orderBy?: 'name' | 'price_asc' | 'price_desc'
  ): Promise<E.Either<Error, ProductList>> {
    // Primero obtener el tenant_id por slug
    const { data: tenant, error: tenantError } = await this.client
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (tenantError) {
      return E.left(tenantError);
    }

    // Buscar productos por tenant_id
    let selectQuery = `
      *,
      product_categories (
        categories (*)
      )
    `;

    // Si hay categoryId, usamos inner join para filtrar
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
      .select(selectQuery)
      .eq('tenant_id', tenant.id);

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
        query = query.order('created_at', { ascending: false });
    }

    const { data, error } = await query;

    if (error) {
      return E.left(error);
    }

    const entities = (data as any[]).map((item) => ({
      ...item,
      product_categories:
        item.product_categories?.map((pc: any) => pc.categories) ?? [],
    }));

    return E.right(ProductListMapper.toDomain(entities));
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
    // Primero obtener el tenant_id por slug
    const { data: tenant, error: tenantError } = await this.client
      .from('tenants')
      .select('id')
      .eq('slug', slug)
      .single();

    if (tenantError) {
      return E.left(tenantError);
    }

    // Buscar categorías por tenant_id
    const { data, error } = await this.client
      .from('categories')
      .select('id, name')
      .eq('tenant_id', tenant.id)
      .eq('is_visible', true)
      .order('position', { ascending: true });

    if (error) {
      return E.left(error);
    }

    return E.right(
      data.map((cat: any) => ({
        id: String(cat.id),
        name: cat.name,
      }))
    );
  }

  private async getExchangeRate(): Promise<number> {
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
  }): Promise<E.Either<Error, void>> {
    // Obtener la tasa de cambio activa del tenant
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
        status: 'pending',
      },
    ]);

    if (error) {
      return E.left(new Error(error.message));
    }

    return E.right(undefined);
  }
}
