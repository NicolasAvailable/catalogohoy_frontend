import { computed } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

export type TenantInfo = {
  tenantId: number | null;
  userId: number | null;
  authUserId: string | null;
  tenantName: string | null;
  tenantSlug: string | null;
};

type TenantState = {
  tenant: TenantInfo;
  isLoading: boolean;
  isLoaded: boolean;
  error: string | null;
};

const initialState: TenantState = {
  tenant: {
    tenantId: null,
    userId: null,
    authUserId: null,
    tenantName: null,
    tenantSlug: null,
  },
  isLoading: false,
  isLoaded: false,
  error: null,
};

// Promise que se resuelve cuando el tenant está cargado
let loadingPromise: Promise<void> | null = null;

export const TenantStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    tenantId: computed(() => store.tenant().tenantId),
    userId: computed(() => store.tenant().userId),
    authUserId: computed(() => store.tenant().authUserId),
    tenantName: computed(() => store.tenant().tenantName),
    tenantSlug: computed(() => store.tenant().tenantSlug),
    hasTenant: computed(() => store.tenant().tenantId !== null),
  })),
  withMethods((store) => {
    const client = SupabaseClientProvider.getInstance();

    const doLoadTenant = async (): Promise<void> => {
      patchState(store, { isLoading: true, error: null });

      try {
        const {
          data: { user },
        } = await client.auth.getUser();

        if (!user) {
          patchState(store, {
            isLoading: false,
            isLoaded: true,
            error: 'User not authenticated',
          });
          return;
        }

        // Obtener user.id de la tabla users
        const { data: userData, error: userError } = await client
          .from('users')
          .select('id')
          .eq('auth_user_id', user.id)
          .maybeSingle();

        if (userError || !userData) {
          patchState(store, {
            isLoading: false,
            isLoaded: true,
            error: 'User not found in users table',
          });
          return;
        }

        // Intentar obtener tenant con is_default=true
        let { data: tenantData } = await client
          .from('users_tenants')
          .select(
            `
            tenant_id,
            tenants (
              id,
              name,
              slug
            )
          `
          )
          .eq('user_id', userData.id)
          .eq('is_default', true)
          .maybeSingle();

        // Si no hay tenant por defecto, obtener el primero disponible
        if (!tenantData) {
          const { data: firstTenant } = await client
            .from('users_tenants')
            .select(
              `
              tenant_id,
              tenants (
                id,
                name,
                slug
              )
            `
            )
            .eq('user_id', userData.id)
            .limit(1)
            .maybeSingle();

          tenantData = firstTenant;
        }

        if (!tenantData) {
          patchState(store, {
            tenant: {
              tenantId: null,
              userId: userData.id,
              authUserId: user.id,
              tenantName: null,
              tenantSlug: null,
            },
            isLoading: false,
            isLoaded: true,
            error: 'No tenant associated with this user',
          });
          return;
        }

        const tenantInfo = tenantData.tenants as unknown as {
          id: number;
          name: string;
          slug: string;
        };

        patchState(store, {
          tenant: {
            tenantId: tenantData.tenant_id,
            userId: userData.id,
            authUserId: user.id,
            tenantName: tenantInfo?.name ?? null,
            tenantSlug: tenantInfo?.slug ?? null,
          },
          isLoading: false,
          isLoaded: true,
          error: null,
        });
      } catch (err) {
        patchState(store, {
          isLoading: false,
          isLoaded: true,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    };

    return {
      async loadTenant(): Promise<void> {
        // Si ya está cargado, no volver a cargar
        if (store.isLoaded() && store.tenant().tenantId !== null) {
          return;
        }

        // Si ya hay una carga en progreso, esperar a que termine
        if (loadingPromise) {
          return loadingPromise;
        }

        loadingPromise = doLoadTenant();
        await loadingPromise;
        loadingPromise = null;
      },

      // Esperar a que el tenant esté cargado y retornar la info
      async ensureLoaded(): Promise<TenantInfo> {
        if (!store.isLoaded()) {
          await this.loadTenant();
        }
        return store.tenant();
      },

      // Método asíncrono para obtener tenant_id (espera a que esté cargado)
      async getTenantIdAsync(): Promise<number | null> {
        const tenant = await this.ensureLoaded();
        return tenant.tenantId;
      },

      async getAuthUserIdAsync(): Promise<string | null> {
        const tenant = await this.ensureLoaded();
        return tenant.authUserId;
      },

      reset(): void {
        loadingPromise = null;
        patchState(store, initialState);
      },

      // Métodos síncronos (solo usar si estás seguro que ya está cargado)
      getTenantId(): number | null {
        return store.tenant().tenantId;
      },

      getUserId(): number | null {
        return store.tenant().userId;
      },

      getAuthUserId(): string | null {
        return store.tenant().authUserId;
      },
    };
  })
);
