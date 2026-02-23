import { Injectable } from '@angular/core';
import { E } from '../../../../shared/domain/src';
import { SupabaseClientProvider } from '../../../core/src';
import { EcommerceConfig } from '../domain';

@Injectable({
  providedIn: 'root',
})
export class EcommerceConfigService {
  private readonly client = SupabaseClientProvider.getInstance();

  async getConfig(tenantId: string): Promise<E.Either<Error, EcommerceConfig>> {
    try {
      const { data: tenant, error: tenantError } = await this.client
        .from('tenants')
        .select('id, name')
        .eq('id', tenantId)
        .single();

      if (tenantError) return E.left(tenantError);

      const { data: config } = await this.client
        .from('tenant_ecommerce_config')
        .select(
          'logo, banner, whatsapp_buttons, description, is_accepting_orders, is_visible, currency, currency_symbol, theme_color, payment_methods, state, city, show_design_section, show_payment_methods_section, show_location_section'
        )
        .eq('tenant_id', tenantId)
        .maybeSingle();

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
        themeColor: config?.theme_color ?? '#10b981',
        paymentMethods: Array.isArray(config?.payment_methods)
          ? config.payment_methods
          : [],
        state: config?.state ?? null,
        city: config?.city ?? null,
        showDesignSection: config?.show_design_section ?? true,
        showPaymentMethodsSection:
          config?.show_payment_methods_section ?? true,
        showLocationSection: config?.show_location_section ?? true,
      });
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
