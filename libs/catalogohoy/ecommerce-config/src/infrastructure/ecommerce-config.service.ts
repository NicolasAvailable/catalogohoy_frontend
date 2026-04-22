import { Injectable } from '@angular/core';
import { E } from '../../../../shared/domain/src';
import { SupabaseClientProvider } from '../../../core/src';
import {
  CatalogTemplate,
  countryNameFromCode,
  DEFAULT_SOCIAL_LINKS,
  EcommerceConfig,
  ExchangeRateType,
  PaymentMethodEntity,
  SocialLinks,
  TenantCurrencyConfig,
} from '../domain';

@Injectable({
  providedIn: 'root',
})
export class EcommerceConfigService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getConfig(tenantId: string): Promise<E.Either<Error, EcommerceConfig>> {
    try {
      const { data: tenant, error: tenantError } = await this.client
        .from('tenants')
        .select('id, name, country, country_code')
        .eq('id', tenantId)
        .single();

      if (tenantError) return E.left(tenantError);

      const { data: config } = await this.client
        .from('tenant_ecommerce_config')
        .select(
          'logo, banner, whatsapp_buttons, description, is_accepting_orders, is_visible, currency, currency_symbol, show_reference_price, show_local_currency_price, theme_color, payment_methods, state, city, show_design_section, show_payment_methods_section, show_location_section, show_categories_section, social_links, template, whatsapp_order_message'
        )
        .eq('tenant_id', tenantId)
        .maybeSingle();

      const countryCode = (tenant as { country_code?: string }).country_code ?? null;
      const country =
        (tenant as { country?: string }).country ?? countryNameFromCode(countryCode);

      return E.right({
        tenantId: String(tenant.id),
        name: tenant.name,
        logo: config?.logo ?? null,
        banner: config?.banner ?? null,
        whatsappButtons: Array.isArray(config?.whatsapp_buttons)
          ? config.whatsapp_buttons
          : [],
        description: config?.description ?? null,
        isAcceptingOrders: config?.is_accepting_orders ?? true,
        isVisible: config?.is_visible ?? true,
        currency: config?.currency ?? 'USD',
        currencySymbol: config?.currency_symbol ?? '$',
        showReferencePrice: config?.show_reference_price ?? true,
        showLocalCurrencyPrice: config?.show_local_currency_price ?? true,
        themeColor: config?.theme_color ?? '#10b981',
        paymentMethods: Array.isArray(config?.payment_methods)
          ? config.payment_methods
          : [],
        country,
        countryCode,
        state: config?.state ?? null,
        city: config?.city ?? null,
        showDesignSection: config?.show_design_section ?? true,
        showPaymentMethodsSection:
          config?.show_payment_methods_section ?? true,
        showLocationSection: config?.show_location_section ?? true,
        showCategoriesSection: config?.show_categories_section ?? true,
        socialLinks: (config?.social_links as SocialLinks) ?? DEFAULT_SOCIAL_LINKS,
        template: (config?.template as CatalogTemplate) ?? 'banner-centered',
        whatsappOrderMessage: config?.whatsapp_order_message ?? null,
      });
    } catch (error) {
      return E.left(error as Error);
    }
  }

  async getCurrencyConfig(
    tenantId: string
  ): Promise<E.Either<Error, TenantCurrencyConfig | null>> {
    try {
      const { data, error } = await this.client
        .from('tenant_currency_config')
        .select(
          'product_currency, display_currency, exchange_rate_type, custom_rate, show_dual_currency, currency_symbol, decimal_separator, thousand_separator'
        )
        .eq('tenant_id', Number(tenantId))
        .maybeSingle();

      if (error) return E.left(new Error(error.message));

      // null signals "no persisted row" — the caller seeds defaults based
      // on the tenant's country instead of returning USD blindly.
      if (!data) return E.right(null);

      return E.right({
        productCurrency: data.product_currency ?? 'USD',
        displayCurrency: data.display_currency ?? 'USD',
        exchangeRateType: (data.exchange_rate_type as ExchangeRateType) ?? 'none',
        customRate: data.custom_rate ?? null,
        showDualCurrency: data.show_dual_currency ?? false,
        currencySymbol: data.currency_symbol ?? '$',
        decimalSeparator: data.decimal_separator ?? ',',
        thousandSeparator: data.thousand_separator ?? '.',
      });
    } catch (error) {
      return E.left(error as Error);
    }
  }

  async updateCurrencyConfig(
    tenantId: string,
    patch: Partial<TenantCurrencyConfig>
  ): Promise<E.Either<Error, void>> {
    try {
      const row: Record<string, unknown> = { tenant_id: Number(tenantId) };
      if (patch.productCurrency !== undefined)
        row['product_currency'] = patch.productCurrency;
      if (patch.displayCurrency !== undefined)
        row['display_currency'] = patch.displayCurrency;
      if (patch.exchangeRateType !== undefined)
        row['exchange_rate_type'] = patch.exchangeRateType;
      if (patch.customRate !== undefined) row['custom_rate'] = patch.customRate;
      if (patch.showDualCurrency !== undefined)
        row['show_dual_currency'] = patch.showDualCurrency;
      if (patch.currencySymbol !== undefined)
        row['currency_symbol'] = patch.currencySymbol;
      if (patch.decimalSeparator !== undefined)
        row['decimal_separator'] = patch.decimalSeparator;
      if (patch.thousandSeparator !== undefined)
        row['thousand_separator'] = patch.thousandSeparator;

      const { error } = await this.client
        .from('tenant_currency_config')
        .upsert(row, { onConflict: 'tenant_id' });

      if (error) return E.left(new Error(error.message));
      return E.right(undefined);
    } catch (error) {
      return E.left(error as Error);
    }
  }

  async updateTenantCountry(
    tenantId: string,
    country: string,
    countryCode: string
  ): Promise<E.Either<Error, void>> {
    try {
      const { error } = await this.client
        .from('tenants')
        .update({ country, country_code: countryCode })
        .eq('id', tenantId);

      if (error) return E.left(new Error(error.message));
      return E.right(undefined);
    } catch (error) {
      return E.left(error as Error);
    }
  }

  async updateConfig(
    config: Partial<EcommerceConfig> & { tenantId: string }
  ): Promise<E.Either<Error, void>> {
    try {
      if (config.name) {
        const { error: tenantError } = await this.client
          .from('tenants')
          .update({ name: config.name })
          .eq('id', config.tenantId);

        if (tenantError) return E.left(new Error(tenantError.message));
      }

      const updateData: Record<string, unknown> = {};
      if (config.logo !== undefined) updateData['logo'] = config.logo;
      if (config.banner !== undefined) updateData['banner'] = config.banner;
      if (config.whatsappButtons !== undefined)
        updateData['whatsapp_buttons'] = config.whatsappButtons;
      if (config.description !== undefined)
        updateData['description'] = config.description;
      if (config.isAcceptingOrders !== undefined)
        updateData['is_accepting_orders'] = config.isAcceptingOrders;
      if (config.isVisible !== undefined)
        updateData['is_visible'] = config.isVisible;
      if (config.currency !== undefined)
        updateData['currency'] = config.currency;
      if (config.currencySymbol !== undefined)
        updateData['currency_symbol'] = config.currencySymbol;
      if (config.showReferencePrice !== undefined)
        updateData['show_reference_price'] = config.showReferencePrice;
      if (config.showLocalCurrencyPrice !== undefined)
        updateData['show_local_currency_price'] = config.showLocalCurrencyPrice;
      if (config.themeColor !== undefined)
        updateData['theme_color'] = config.themeColor;
      if (config.paymentMethods !== undefined)
        updateData['payment_methods'] = config.paymentMethods;
      if (config.state !== undefined) updateData['state'] = config.state;
      if (config.city !== undefined) updateData['city'] = config.city;
      if (config.showDesignSection !== undefined)
        updateData['show_design_section'] = config.showDesignSection;
      if (config.showPaymentMethodsSection !== undefined)
        updateData['show_payment_methods_section'] =
          config.showPaymentMethodsSection;
      if (config.showLocationSection !== undefined)
        updateData['show_location_section'] = config.showLocationSection;
      if (config.showCategoriesSection !== undefined)
        updateData['show_categories_section'] = config.showCategoriesSection;
      if (config.socialLinks !== undefined)
        updateData['social_links'] = config.socialLinks;
      if (config.template !== undefined)
        updateData['template'] = config.template;
      if (config.whatsappOrderMessage !== undefined)
        updateData['whatsapp_order_message'] = config.whatsappOrderMessage;

      if (Object.keys(updateData).length > 0) {
        const tenantIdNum = Number(config.tenantId);

        const { error: configError } = await this.client
          .from('tenant_ecommerce_config')
          .upsert(
            { tenant_id: tenantIdNum, ...updateData },
            { onConflict: 'tenant_id' }
          );

        if (configError) return E.left(new Error(configError.message));
      }

      return E.right(undefined);
    } catch (error) {
      return E.left(error as Error);
    }
  }

  async getPaymentMethods(
    tenantId: string
  ): Promise<E.Either<Error, PaymentMethodEntity[]>> {
    const { data, error } = await this.client
      .from('payment_methods')
      .select('*')
      .eq('tenant_id', Number(tenantId))
      .order('created_at', { ascending: true });

    if (error) return E.left(new Error(error.message));

    return E.right(
      (data || []).map((row: any) => ({
        id: row.id,
        tenantId: row.tenant_id,
        name: row.name,
        icon: row.icon,
        isActive: row.is_active,
        createdAt: row.created_at,
      }))
    );
  }

  async createPaymentMethod(
    tenantId: string,
    name: string,
    icon: string
  ): Promise<E.Either<Error, PaymentMethodEntity>> {
    const { data, error } = await this.client
      .from('payment_methods')
      .insert({ tenant_id: Number(tenantId), name, icon })
      .select()
      .single();

    if (error) return E.left(new Error(error.message));

    return E.right({
      id: data.id,
      tenantId: data.tenant_id,
      name: data.name,
      icon: data.icon,
      isActive: data.is_active,
      createdAt: data.created_at,
    });
  }

  async updatePaymentMethod(
    id: number,
    updates: { name?: string; icon?: string; is_active?: boolean }
  ): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('payment_methods')
      .update(updates)
      .eq('id', id);

    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async deletePaymentMethod(id: number): Promise<E.Either<Error, void>> {
    const { error } = await this.client
      .from('payment_methods')
      .delete()
      .eq('id', id);

    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  async uploadLogo(
    tenantId: string,
    file: File
  ): Promise<E.Either<Error, string>> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/logo-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await this.client.storage
        .from('tenants')
        .upload(filePath, file);

      if (uploadError) return E.left(uploadError);

      const { data } = this.client.storage
        .from('tenants')
        .getPublicUrl(filePath);

      return E.right(data.publicUrl);
    } catch (error) {
      return E.left(error as Error);
    }
  }

  async uploadBanner(
    tenantId: string,
    file: File
  ): Promise<E.Either<Error, string>> {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${tenantId}/banner-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await this.client.storage
        .from('tenants')
        .upload(filePath, file);

      if (uploadError) return E.left(uploadError);

      const { data } = this.client.storage
        .from('tenants')
        .getPublicUrl(filePath);

      return E.right(data.publicUrl);
    } catch (error) {
      return E.left(error as Error);
    }
  }
}
