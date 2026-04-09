import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { PlatformUser } from './users.model';
import { UsersService } from './users.service';

type UsersState = {
  users: PlatformUser[];
  isLoading: boolean;
  error: string | null;
};

const initialState: UsersState = {
  users: [],
  isLoading: false,
  error: null,
};

export const UsersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, usersService = inject(UsersService)) => ({
    async load() {
      patchState(store, { isLoading: true, error: null });
      const result = await usersService.list();
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (users) => patchState(store, { users, isLoading: false })
      );
    },
  }))
);
