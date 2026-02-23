import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { toast } from 'ngx-sonner';
import { EcommerceConfig, PaymentMethod } from '../domain';
import { EcommerceConfigService } from './ecommerce-config.service';

type EcommerceConfigState = {
  config: EcommerceConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  savingSection: string | null;
  error: string | null;
};

const initialState: EcommerceConfigState = {
  config: null,
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
      patchState(store, { isLoading: true, error: null });
      const result = await service.getConfig(tenantId);
      result.fold(
        (error: Error) =>
          patchState(store, { isLoading: false, error: error.message }),
        (config: EcommerceConfig) =>
          patchState(store, { isLoading: false, config })
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

    async savePaymentMethods(data: {
      paymentMethods: PaymentMethod[];
      showPaymentMethodsSection: boolean;
    }) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true, savingSection: 'paymentMethods' });
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
          toast.error('Error al guardar los métodos de pago');
        },
        () => {
          patchState(store, {
            isSaving: false,
            savingSection: null,
            config: { ...currentConfig, ...data },
          });
          toast.success('Métodos de pago actualizados');
        }
      );
    },
  }))
);
