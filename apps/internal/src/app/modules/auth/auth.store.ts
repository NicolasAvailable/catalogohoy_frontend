import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { AuthService, AuthSession } from './auth.service';

type AuthState = {
  session: AuthSession | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;
};

const initialState: AuthState = {
  session: null,
  isLoading: false,
  isInitialized: false,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, authService = inject(AuthService)) => ({
    async init() {
      if (store.isInitialized()) return;
      const session = await authService.getSession();
      patchState(store, { session, isInitialized: true });
    },

    async login(email: string, password: string): Promise<boolean> {
      patchState(store, { isLoading: true, error: null });
      const result = await authService.login(email, password);
      return result.fold(
        (err) => {
          patchState(store, { isLoading: false, error: err.message });
          return false;
        },
        (session) => {
          patchState(store, {
            session,
            isLoading: false,
            isInitialized: true,
          });
          return true;
        }
      );
    },

    async logout() {
      await authService.logout();
      patchState(store, { session: null });
    },

    clearError() {
      patchState(store, { error: null });
    },
  }))
);
