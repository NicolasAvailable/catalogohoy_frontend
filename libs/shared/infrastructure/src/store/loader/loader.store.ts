import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';

type LoaderState = {
  isEnable: boolean;
};

const initialState: LoaderState = {
  isEnable: false,
};

export const LoaderStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => ({
    isDisable() {
      return !store.isEnable();
    },
    enable() {
      patchState(store, () => ({ isEnable: true }));
    },
    disable() {
      patchState(store, () => ({ isEnable: false }));
    },
  }))
);
