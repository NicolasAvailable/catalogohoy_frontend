import { Injectable } from '@angular/core';
import { E } from '../../../../shared/domain/src';
import { SupabaseClientProvider } from '../../../core/src';
import {
  BusinessHoursDay,
  BusinessHoursWeek,
  CatalogTemplate,
  countryNameFromCode,
  CustomerFieldsConfig,
  DEFAULT_BUSINESS_HOURS_WEEK,
  DEFAULT_CUSTOMER_FIELDS,
  DEFAULT_DELIVERY_BLOCKED_WEEKDAYS,
  DEFAULT_SOCIAL_LINKS,
  EcommerceConfig,
  ExchangeRateType,
  PaymentMethodEntity,
  ShippingMethod,
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
          'logo, banner, whatsapp_buttons, description, is_accepting_orders, is_visible, currency, currency_symbol, show_reference_price, show_local_currency_price, theme_color, payment_methods, state, city, show_design_section, show_payment_methods_section, show_location_section, show_categories_section, social_links, template, whatsapp_order_message, notify_new_orders, notify_weekly_report, shipping_methods, show_shipping_section, customer_fields, default_language'
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
        defaultLanguage: (config?.default_language as string) ?? 'es',
        whatsappOrderMessage: config?.whatsapp_order_message ?? null,
        notifyNewOrders: config?.notify_new_orders ?? true,
        notifyWeeklyReport: config?.notify_weekly_report ?? true,
        shippingMethods: Array.isArray(config?.shipping_methods)
          ? (config.shipping_methods as ShippingMethod[])
          : [],
        showShippingSection: config?.show_shipping_section ?? false,
        customerFields:
          (config?.customer_fields as CustomerFieldsConfig) ??
          DEFAULT_CUSTOMER_FIELDS,
        // Delivery-date settings live inside the `customer_fields` jsonb column
        // (no dedicated DB column) so they flow through the public RPC (which
        // returns customer_fields verbatim) with no migration.
        deliveryDateEnabled:
          (config?.customer_fields as { deliveryDateEnabled?: boolean })
            ?.deliveryDateEnabled ?? false,
        deliveryBlockedWeekdays: Array.isArray(
          (config?.customer_fields as { deliveryBlockedWeekdays?: number[] })
            ?.deliveryBlockedWeekdays
        )
          ? ((config?.customer_fields as { deliveryBlockedWeekdays?: number[] })
              .deliveryBlockedWeekdays as number[])
          : DEFAULT_DELIVERY_BLOCKED_WEEKDAYS,
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

  /** Cambia el slug del catálogo vía RPC. El servidor valida owner, formato,
   *  unicidad y el límite de 2 cambios por cada 30 días; los códigos de error
   *  (limit_reached, slug_taken, …) llegan en error.message. */
  async changeTenantSlug(
    tenantId: string,
    newSlug: string
  ): Promise<E.Either<Error, { slug: string; remaining: number }>> {
    try {
      const { data, error } = await this.client.rpc('change_tenant_slug', {
        p_tenant_id: Number(tenantId),
        p_new_slug: newSlug,
      });

      if (error) return E.left(new Error(error.message));
      const payload = data as { slug: string; remaining: number };
      return E.right({ slug: payload.slug, remaining: payload.remaining });
    } catch (error) {
      return E.left(error as Error);
    }
  }

  /** Estado del límite de cambios de slug: usados en los últimos 30 días
   *  (RLS: solo miembros del tenant) + límite del tenant
   *  (tenants.slug_change_limit, default 2 — override para demos/internos). */
  async getSlugChangeStatus(
    tenantId: string
  ): Promise<E.Either<Error, { used: number; limit: number }>> {
    try {
      const since = new Date(
        Date.now() - 30 * 24 * 60 * 60 * 1000
      ).toISOString();
      const [countRes, tenantRes] = await Promise.all([
        this.client
          .from('tenant_slug_changes')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gt('changed_at', since),
        this.client
          .from('tenants')
          .select('slug_change_limit')
          .eq('id', tenantId)
          .single(),
      ]);

      if (countRes.error) return E.left(new Error(countRes.error.message));
      if (tenantRes.error) return E.left(new Error(tenantRes.error.message));
      return E.right({
        used: countRes.count ?? 0,
        limit:
          (tenantRes.data?.slug_change_limit as number | null) ?? 2,
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
      if (config.defaultLanguage !== undefined)
        updateData['default_language'] = config.defaultLanguage;
      if (config.whatsappOrderMessage !== undefined)
        updateData['whatsapp_order_message'] = config.whatsappOrderMessage;
      if (config.notifyNewOrders !== undefined)
        updateData['notify_new_orders'] = config.notifyNewOrders;
      if (config.notifyWeeklyReport !== undefined)
        updateData['notify_weekly_report'] = config.notifyWeeklyReport;
      if (config.shippingMethods !== undefined)
        updateData['shipping_methods'] = config.shippingMethods;
      if (config.showShippingSection !== undefined)
        updateData['show_shipping_section'] = config.showShippingSection;
      // `customer_fields` also carries the delivery-date settings (no dedicated
      // DB column). Merge them into the same jsonb so a change to either the
      // fields OR the delivery settings persists the combined object. When only
      // the delivery settings changed we still need to write the fields shape,
      // so fall back to the passed customerFields (already synced with server).
      if (
        config.customerFields !== undefined ||
        config.deliveryDateEnabled !== undefined ||
        config.deliveryBlockedWeekdays !== undefined
      ) {
        const base =
          config.customerFields ??
          (DEFAULT_CUSTOMER_FIELDS as CustomerFieldsConfig);
        updateData['customer_fields'] = {
          ...base,
          ...(config.deliveryDateEnabled !== undefined
            ? { deliveryDateEnabled: config.deliveryDateEnabled }
            : {}),
          ...(config.deliveryBlockedWeekdays !== undefined
            ? { deliveryBlockedWeekdays: config.deliveryBlockedWeekdays }
            : {}),
        };
      }

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

  /** Lee los toggles de notificaciones WhatsApp + los números destinatarios
   *  del aviso de nueva orden, desde `whatsapp_notification_settings`.
   *  `maxRecipients` sale de `tenants.whatsapp_notify_numbers_limit` (default
   *  1) — solo tenants habilitados a mano pueden configurar un 2º número. */
  async getWhatsappNotifySettings(tenantId: string): Promise<
    E.Either<
      Error,
      {
        orderReceived: boolean;
        orderCompleted: boolean;
        recipientNumber: string | null;
        recipientNumber2: string | null;
        maxRecipients: number;
      }
    >
  > {
    const { data, error } = await this.client
      .from('whatsapp_notification_settings')
      .select('type, enabled, recipient_number, recipient_number_2')
      .eq('tenant_id', Number(tenantId));
    if (error) return E.left(new Error(error.message));

    const { data: tenant, error: tenantError } = await this.client
      .from('tenants')
      .select('whatsapp_notify_numbers_limit')
      .eq('id', Number(tenantId))
      .single();
    if (tenantError) return E.left(new Error(tenantError.message));

    const byType = new Map(
      (data ?? []).map(
        (r: {
          type: string;
          enabled: boolean;
          recipient_number: string | null;
          recipient_number_2: string | null;
        }) => [r.type, r]
      )
    );
    const received = byType.get('order_received');
    const completed = byType.get('order_completed');
    return E.right({
      // Sin fila → "nueva orden recibida" arranca activa por defecto.
      orderReceived: received?.enabled ?? true,
      orderCompleted: completed?.enabled ?? false,
      recipientNumber: received?.recipient_number ?? null,
      recipientNumber2: received?.recipient_number_2 ?? null,
      maxRecipients: tenant?.whatsapp_notify_numbers_limit ?? 1,
    });
  }

  /** Upsert de los toggles + números destinatarios. El template y el idioma
   *  los fija la plataforma; el tenant solo togglea y elige a qué números
   *  avisar. El 2º número solo lo usa el trigger si el tenant tiene cupo
   *  (`whatsapp_notify_numbers_limit >= 2`). */
  async saveWhatsappNotifySettings(
    tenantId: string,
    settings: {
      orderReceived: boolean;
      orderCompleted: boolean;
      recipientNumber: string | null;
      recipientNumber2: string | null;
    }
  ): Promise<E.Either<Error, void>> {
    const tenantIdNum = Number(tenantId);
    const rows = [
      {
        tenant_id: tenantIdNum,
        type: 'order_received',
        enabled: settings.orderReceived,
        recipient_number: settings.recipientNumber,
        recipient_number_2: settings.recipientNumber2,
        meta_template_name: 'order_received',
        language_code: 'es',
      },
      {
        tenant_id: tenantIdNum,
        type: 'order_completed',
        enabled: settings.orderCompleted,
        recipient_number: null,
        recipient_number_2: null,
        meta_template_name: 'order_completed',
        language_code: 'es',
      },
    ];
    const { error } = await this.client
      .from('whatsapp_notification_settings')
      .upsert(rows, { onConflict: 'tenant_id,type' });
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  /** Envía una notificación WhatsApp de prueba (template real con datos de
   *  ejemplo) al número que se está configurando. La edge function autentica
   *  con el JWT del usuario. */
  async sendTestWhatsapp(
    to: string,
    tenantName: string,
    tenantId: string
  ): Promise<E.Either<Error, void>> {
    const { data, error } = await this.client.functions.invoke(
      'send-whatsapp-test',
      { body: { to, tenantName, tenantId: Number(tenantId) } }
    );
    if (error) return E.left(new Error(error.message));
    if (!data?.success) {
      return E.left(new Error(data?.error ?? 'No se pudo enviar la prueba'));
    }
    return E.right(undefined);
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
        details: row.details ?? {},
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
      details: data.details ?? {},
    });
  }

  async updatePaymentMethod(
    id: number,
    updates: {
      name?: string;
      icon?: string;
      is_active?: boolean;
      details?: Record<string, string>;
    }
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

  /** Reads all 7 days of `tenant_business_hours`. If the tenant doesn't yet
   *  have a row for some days, fills in defaults so the editor renders a
   *  complete week without having to handle missing rows. */
  async getBusinessHours(
    tenantId: string
  ): Promise<E.Either<Error, BusinessHoursWeek>> {
    const { data, error } = await this.client
      .from('tenant_business_hours')
      .select('day_of_week, open_time, close_time, is_open')
      .eq('tenant_id', Number(tenantId))
      .order('day_of_week', { ascending: true });

    if (error) return E.left(new Error(error.message));

    const byDay = new Map<number, BusinessHoursDay>();
    for (const row of (data ?? []) as Array<{
      day_of_week: number;
      open_time: string;
      close_time: string;
      is_open: boolean;
    }>) {
      byDay.set(row.day_of_week, {
        dayOfWeek: row.day_of_week,
        openTime: row.open_time,
        closeTime: row.close_time,
        isOpen: row.is_open,
      });
    }

    return E.right(
      DEFAULT_BUSINESS_HOURS_WEEK.map((d) => byDay.get(d.dayOfWeek) ?? { ...d })
    );
  }

  /** Upserts a full week of business hours via the (tenant_id, day_of_week)
   *  UNIQUE constraint, so existing rows are updated in place and missing
   *  ones are inserted in a single round-trip. */
  async upsertBusinessHours(
    tenantId: string,
    week: BusinessHoursWeek
  ): Promise<E.Either<Error, void>> {
    const tenantIdNum = Number(tenantId);

    const rows = week.map((d) => ({
      tenant_id: tenantIdNum,
      day_of_week: d.dayOfWeek,
      open_time: d.openTime,
      close_time: d.closeTime,
      is_open: d.isOpen,
    }));

    const { error } = await this.client
      .from('tenant_business_hours')
      .upsert(rows, { onConflict: 'tenant_id,day_of_week' });

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
