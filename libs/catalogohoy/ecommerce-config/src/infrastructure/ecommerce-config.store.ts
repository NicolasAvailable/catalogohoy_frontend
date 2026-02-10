import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { EcommerceConfig } from '../domain';
import { EcommerceConfigService } from './ecommerce-config.service';

type EcommerceConfigState = {
  config: EcommerceConfig | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
};

const initialState: EcommerceConfigState = {
  config: null,
  isLoading: false,
  isSaving: false,
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

      patchState(store, { isSaving: true });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        name,
      });

      result.fold(
        (error: Error) =>
          patchState(store, { isSaving: false, error: error.message }),
        () => {
          patchState(store, {
            isSaving: false,
            config: { ...currentConfig, name },
          });
        }
      );
    },

    async updateIsAcceptingOrders(isAcceptingOrders: boolean) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true });
      const result = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        isAcceptingOrders,
      });

      result.fold(
        (error: Error) =>
          patchState(store, { isSaving: false, error: error.message }),
        () => {
          patchState(store, {
            isSaving: false,
            config: { ...currentConfig, isAcceptingOrders },
          });
        }
      );
    },

    async uploadLogo(file: File) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true });
      const uploadResult = await service.uploadLogo(
        currentConfig.tenantId,
        file
      );

      if (uploadResult.isLeft()) {
        patchState(store, {
          isSaving: false,
          error: uploadResult.value.message,
        });
        return;
      }

      const logoUrl = uploadResult.value;
      const updateResult = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        logo: logoUrl,
      });

      updateResult.fold(
        (error: Error) =>
          patchState(store, { isSaving: false, error: error.message }),
        () => {
          patchState(store, {
            isSaving: false,
            config: { ...currentConfig, logo: logoUrl },
          });
        }
      );
    },

    async updateLogoUrl(logoUrl: string) {
      const currentConfig = store.config();
      if (!currentConfig) return;

      patchState(store, { isSaving: true });
      const updateResult = await service.updateConfig({
        tenantId: currentConfig.tenantId,
        logo: logoUrl,
      });

      updateResult.fold(
        (error: Error) =>
          patchState(store, { isSaving: false, error: error.message }),
        () => {
          patchState(store, {
            isSaving: false,
            config: { ...currentConfig, logo: logoUrl },
          });
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
        (error: Error) =>
          patchState(store, { isSaving: false, error: error.message }),
        () => {
          patchState(store, {
            isSaving: false,
            config: { ...currentConfig, ...partialConfig },
          });
        }
      );
    },
  }))
);
