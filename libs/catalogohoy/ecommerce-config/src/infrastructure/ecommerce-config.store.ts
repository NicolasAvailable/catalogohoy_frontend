import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { toast } from 'ngx-sonner';
import {
  CatalogTemplate,
  DEFAULT_CURRENCY_CONFIG,
  DEFAULT_PAYMENT_METHODS,
  EcommerceConfig,
  PaymentMethod,
  PaymentMethodEntity,
  TenantCurrencyConfig,
} from '../domain';
import { EcommerceConfigService } from './ecommerce-config.service';

type EcommerceConfigState = {
  config: EcommerceConfig | null;
  currencyConfig: TenantCurrencyConfig;
  /** false until loadCurrencyConfig runs; true only when a DB row actually exists. */
  currencyConfigExists: boolean;
  paymentMethodsList: PaymentMethodEntity[];
  isLoading: boolean;
  isSaving: boolean;
  savingSection: string | null;
  error: string | null;
};

const initialState: EcommerceConfigState = {
  config: null,
  currencyConfig: { ...DEFAULT_CURRENCY_CONFIG },
  currencyConfigExists: false,
  paymentMethodsList: [],
  isLoading: false,
  isSaving: false,
  savingSection: null,
  error: null,
};

export const EcommerceConfigStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, service = inject(EcommerceConfigService)) => ({
    async loadConfig(tenantId: string) {
      if (store.config() !== null) return;
      patchState(store, { isLoading: true, error: null });
      const result = await service.getConfig(tenantId);
      result.fold(
        (error: Error) =>
          patchState(store, { isLoading: false, error: error.message }),
        (config: EcommerceConfig) =>
          patchState(store, { isLoading: false, config })
      );
    },

    async reloadConfig(tenantId: string) {
      patchState(store, { isLoading: true, error: null });
      const result = await service.getConfig(tenantId);
      result.fold(
        (error: Error) =>
          patchState(store, { isLoading: false, error: error.message }),
        (config: EcommerceConfig) =>
          patchState(store, { isLoading: false, config })
      );
    },

    async loadCurrencyConfig(tenantId: string) {
      const result = await service.getCurrencyConfig(tenantId);
      result.mapRight((currencyConfig) => {
        if (currencyConfig === null) {
          patchState(store, {
            currencyConfig: { ...DEFAULT_CURRENCY_CONFIG },
            currencyConfigExists: false,
          });
        } else {
          patchState(store, {
            currencyConfig,
            currencyConfigExists: true,
          });
        }
      });
    },

    async saveCurrencyConfig(patch: Partial<TenantCurrencyConfig>) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'currency' });
      const result = await service.updateCurrencyConfig(
        currentConfig.tenantId,
        patch
      );

      result.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar la moneda');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            currencyConfig: { ...store.currencyConfig(), ...patch },
            currencyConfigExists: true,
          });
          // No success toast — this fires alongside the main "Configuración
          // actualizada" toast from updatePartialConfig; a second one is noise.
        }
      );
    },

    async saveTenantCountry(country: string, countryCode: string) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'country' });
      const result = await service.updateTenantCountry(
        currentConfig.tenantId,
        country,
        countryCode
      );

      result.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar el país');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, country, countryCode },
          });
        }
      );
    },

    async updateName(name: string) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'identity' });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        name,
      });

      result.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar el nombre');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, name },
          });
          toast.success('Nombre actualizado correctamente');
        }
      );
    },

    async updateIsAcceptingOrders(isAcceptingOrders: boolean) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'behavior' });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        isAcceptingOrders,
      });

      result.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al actualizar estado de pedidos');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, isAcceptingOrders },
          });
          toast.success(
            isAcceptingOrders ? 'Pedidos activados' : 'Pedidos desactivados'
          );
        }
      );
    },

    async uploadLogo(file: File) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'design' });
      const uploadResult = await service.uploadLogo(
        currentConfig.tenantId,
        file
      );

      if (uploadResult.isLeft()) {
        patchState(store, {
          isSaving: false,
          savingSection: null,
          error: uploadResult.value.message,
        });
        toast.error('Error al subir el logo');
        return;
      }

      const logoUrl = uploadResult.value;
      const updateResult = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        logo: logoUrl,
      });

      updateResult.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar el logo');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, logo: logoUrl },
          });
          toast.success('Logo actualizado correctamente');
        }
      );
    },

    async uploadBanner(file: File) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'design' });
      const uploadResult = await service.uploadBanner(
        currentConfig.tenantId,
        file
      );

      if (uploadResult.isLeft()) {
        patchState(store, {
          isSaving: false,
          savingSection: null,
          error: uploadResult.value.message,
        });
        toast.error('Error al subir el banner');
        return;
      }

      const bannerUrl = uploadResult.value;
      const updateResult = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        banner: bannerUrl,
      });

      updateResult.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar el banner');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, banner: bannerUrl },
          });
          toast.success('Banner actualizado correctamente');
        }
      );
    },

    async updateLogoUrl(logoUrl: string) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'design' });
      const updateResult = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        logo: logoUrl,
      });

      updateResult.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar el logo');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, logo: logoUrl },
          });
          toast.success('Logo actualizado correctamente');
        }
      );
    },

    async updateBannerUrl(bannerUrl: string) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'design' });
      const updateResult = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        banner: bannerUrl,
      });

      updateResult.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar el banner');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, banner: bannerUrl },
          });
          toast.success('Banner actualizado correctamente');
        }
      );
    },

    async updatePartialConfig(partialConfig: Partial<EcommerceConfig>) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        ...partialConfig,
      });

      result.fold(
        (error: Error) => {
          patchState(store, { isSaving: false, error: error.message });
          toast.error('Error al guardar la configuración');
        },
        () => {
          patchState(store, {
            isSaving: false,
            config: { ...currentConfig, ...partialConfig },
          });
          toast.success('Configuración actualizada correctamente');
        }
      );
    },

    async saveDesignSection(data: { showDesignSection: boolean }) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'design' });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        showDesignSection: data.showDesignSection,
      });

      result.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar la sección de diseño');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, ...data },
          });
          toast.success('Sección de diseño actualizada');
        }
      );
    },

    async saveLocationSection(data: {
      state: string | null;
      city: string | null;
      showLocationSection: boolean;
    }) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'location' });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        ...data,
      });

      result.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar la ubicación');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, ...data },
          });
          toast.success('Ubicación actualizada correctamente');
        }
      );
    },

    async saveThemeColor(themeColor: string) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'themeColor' });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        themeColor,
      });

      result.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar el color del tema');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, themeColor },
          });
          toast.success('Color del tema actualizado');
        }
      );
    },

    async saveTemplate(template: CatalogTemplate) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'template' });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        template,
      });

      result.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar la plantilla');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, template },
          });
          toast.success('Plantilla actualizada');
        }
      );
    },

    async savePaymentMethodsSection(showPaymentMethodsSection: boolean) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'paymentMethods' });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        showPaymentMethodsSection,
      });

      result.fold(
        (error: Error) => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            error: error.message,
          });
          toast.error('Error al guardar la sección de pago');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, showPaymentMethodsSection },
          });
          toast.success('Sección de pago actualizada');
        }
      );
    },

    async loadPaymentMethods(tenantId: string) {
      const result = await service.getPaymentMethods(tenantId);
      result.fold(
        () => {
          toast.error('Error al cargar métodos de pago');
        },
        async (methods: PaymentMethodEntity[]) => {
          if (methods.length === 0) {
            const created: PaymentMethodEntity[] = [];
            for (const def of DEFAULT_PAYMENT_METHODS) {
              const r = await service.createPaymentMethod(tenantId, def.name, def.icon);
              r.mapRight((m) => created.push(m));
            }
            patchState(store, { paymentMethodsList: created });
          } else {
            patchState(store, { paymentMethodsList: methods });
          }
        }
      );
    },

    async addPaymentMethod(name: string, icon: string) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      const loadingId = toast.loading('Creando método de pago...');
      const result = await service.createPaymentMethod(
        currentConfig.tenantId,
        name,
        icon
      );
      toast.dismiss(loadingId);
      result.fold(
        () => {
          toast.error('Error al crear método de pago');
        },
        (newMethod: PaymentMethodEntity) => {
          patchState(store, {
            paymentMethodsList: [...store.paymentMethodsList(), newMethod],
          });
          toast.success('Método de pago creado');
        }
      );
    },

    async togglePaymentMethodActive(id: number, isActive: boolean) {
      const result = await service.updatePaymentMethod(id, {
        is_active: isActive,
      });
      result.fold(
        () => {
          toast.error('Error al actualizar método de pago');
        },
        () => {
          const updated = store
            .paymentMethodsList()
            .map((m) => (m.id === id ? { ...m, isActive } : m));
          patchState(store, { paymentMethodsList: updated });
        }
      );
    },

    async removePaymentMethod(id: number) {
      const result = await service.deletePaymentMethod(id);
      result.fold(
        () => {
          toast.error('Error al eliminar método de pago');
        },
        () => {
          const filtered = store
            .paymentMethodsList()
            .filter((m) => m.id !== id);
          patchState(store, { paymentMethodsList: filtered });
          toast.success('Método de pago eliminado');
        }
      );
    },
  }))
);
