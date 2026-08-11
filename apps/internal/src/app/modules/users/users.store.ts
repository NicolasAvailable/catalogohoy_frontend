import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { PlatformUser } from './users.model';
import { UsersService } from './users.service';

const PAGE_SIZE = 100;

type UsersState = {
  users: PlatformUser[];
  total: number;
  search: string;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
};

const initialState: UsersState = {
  users: [],
  total: 0,
  search: '',
  isLoading: false,
  isLoadingMore: false,
  error: null,
};

export const UsersStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, usersService = inject(UsersService)) => {
    /** Fetch the first page for the current search, replacing the list. */
    async function load(): Promise<void> {
      patchState(store, { isLoading: true, error: null });
      const result = await usersService.list({
        search: store.search(),
        limit: PAGE_SIZE,
        offset: 0,
      });
      result.fold(
        (err) => patchState(store, { isLoading: false, error: err.message }),
        (page) =>
          patchState(store, {
            users: page.rows,
            total: page.total,
            isLoading: false,
          })
      );
    }

    return {
      load,

      /** Debounced from the component: set the term and reload page 1. */
      async setSearch(term: string): Promise<void> {
        patchState(store, { search: term });
        await load();
      },

      /** Append the next page (server-side offset) without losing what's loaded. */
      async loadMore(): Promise<void> {
        if (store.isLoadingMore() || store.users().length >= store.total()) {
          return;
        }
        patchState(store, { isLoadingMore: true, error: null });
        const result = await usersService.list({
          search: store.search(),
          limit: PAGE_SIZE,
          offset: store.users().length,
        });
        result.fold(
          (err) =>
            patchState(store, { isLoadingMore: false, error: err.message }),
          (page) =>
            patchState(store, {
              users: [...store.users(), ...page.rows],
              total: page.total,
              isLoadingMore: false,
            })
        );
      },
    };
  })
);
