import { computed, inject } from '@angular/core';
import { TenantStore } from '@catalogohoy/tenant';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import {
  CreateWhatsAppAccountPayload,
  EmbeddedSignupPayload,
  WhatsAppAccount,
} from '../domain';
import { WhatsAppService } from './whatsapp.service';

type WhatsAppState = {
  accounts: WhatsAppAccount[];
  isLoading: boolean;
  isConnecting: boolean;
  error: string | null;
};

const initialState: WhatsAppState = {
  accounts: [],
  isLoading: false,
  isConnecting: false,
  error: null,
};

export const WhatsAppStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    hasActiveAccount: computed(() =>
      store.accounts().some((a) => a.status === 'active')
    ),
    activeAccounts: computed(() =>
      store.accounts().filter((a) => a.status === 'active')
    ),
  })),
  withMethods(
    (
      store,
      whatsAppService = inject(WhatsAppService),
      tenantStore = inject(TenantStore)
    ) => ({
      async loadAccounts() {
        patchState(store, { isLoading: true, error: null });

        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isLoading: false });
          return;
        }

        const result = await whatsAppService.getAccountsByTenant(tenantId);

        result.fold(
          (err) =>
            patchState(store, { isLoading: false, error: err.message }),
          (accounts) =>
            patchState(store, { accounts, isLoading: false })
        );
      },

      async registerAccount(
        payload: CreateWhatsAppAccountPayload
      ): Promise<WhatsAppAccount | null> {
        patchState(store, { isConnecting: true, error: null });

        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isConnecting: false });
          return null;
        }

        const result = await whatsAppService.createAccount(tenantId, payload);

        let created: WhatsAppAccount | null = null;

        result.fold(
          (err) =>
            patchState(store, { isConnecting: false, error: err.message }),
          (account) => {
            created = account;
            patchState(store, {
              accounts: [account, ...store.accounts()],
              isConnecting: false,
            });
          }
        );

        return created;
      },

      async registerFromEmbeddedSignup(
        payload: EmbeddedSignupPayload
      ): Promise<WhatsAppAccount | null> {
        patchState(store, { isConnecting: true, error: null });

        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isConnecting: false });
          return null;
        }

        const result = await whatsAppService.createAccountFromSignup(
          tenantId,
          payload
        );

        let created: WhatsAppAccount | null = null;

        result.fold(
          (err) =>
            patchState(store, { isConnecting: false, error: err.message }),
          (account) => {
            created = account;
            patchState(store, {
              accounts: [account, ...store.accounts()],
              isConnecting: false,
            });
          }
        );

        return created;
      },

      /** Connect a fake WhatsApp account so the inbox can be tested end-to-end
       *  before Meta approves the real API. Clearly labeled as demo; the
       *  public customer simulator chats against this same tenant. */
      async connectDemoAccount(): Promise<WhatsAppAccount | null> {
        patchState(store, { isConnecting: true, error: null });

        const tenantId = await tenantStore.getTenantIdAsync();
        if (!tenantId) {
          patchState(store, { isConnecting: false });
          return null;
        }

        const result = await whatsAppService.createAccount(tenantId, {
          phoneNumber: '+10000000000',
          displayName: 'Cuenta de prueba (demo)',
          wabaId: null,
          phoneNumberId: null,
        });

        let created: WhatsAppAccount | null = null;
        result.fold(
          (err) => patchState(store, { isConnecting: false, error: err.message }),
          (account) => {
            created = account;
            patchState(store, {
              accounts: [account, ...store.accounts()],
              isConnecting: false,
            });
          }
        );
        return created;
      },

      async removeAccount(id: number) {
        const result = await whatsAppService.deleteAccount(id);

        result.fold(
          (err) => patchState(store, { error: err.message }),
          () =>
            patchState(store, {
              accounts: store.accounts().filter((a) => a.id !== id),
            })
        );
      },
    })
  )
);
