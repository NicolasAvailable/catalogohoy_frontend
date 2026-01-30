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

    return {
      async loadTenant(): Promise<void> {
        // Si ya está cargado, no volver a cargar
        if (store.isLoaded() && store.tenant().tenantId !== null) {
          return;
        }

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
      },

      reset(): void {
        patchState(store, initialState);
      },

      // Método sincrónico para obtener tenant_id (para usar en servicios)
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
