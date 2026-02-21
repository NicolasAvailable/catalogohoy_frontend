Create an NgRx Signal Store for: $ARGUMENTS

Follow the project's established pattern exactly. The store name should be `$ARGUMENTSStore`.

## Template

```typescript
import { inject } from '@angular/core';
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { computed } from '@angular/core';
// Import the service and model for this domain
import { $ARGUMENTSService } from './$ARGUMENTS.service';
import type { $ARGUMENTS } from '../domain/$ARGUMENTS.model';

interface $ARGUMENTSState {
  items: $ARGUMENTS[];
  selected: $ARGUMENTS | null;
  loading: boolean;
  error: string | null;
  // Add filters or pagination state here
}

const initialState: $ARGUMENTSState = {
  items: [],
  selected: null,
  loading: false,
  error: null,
};

export const $ARGUMENTSStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => ({
    // Derive computed signals from state
    isEmpty: computed(() => store.items().length === 0),
    hasError: computed(() => store.error() !== null),
  })),
  withMethods((store, service = inject($ARGUMENTSService)) => ({
    async loadAll(slug: string) {
      patchState(store, { loading: true, error: null });
      const result = await service.getAll(slug);
      result
        .mapRight((items) => patchState(store, { items, loading: false }))
        .mapLeft((err) => patchState(store, { error: err.message, loading: false }));
    },

    select(item: $ARGUMENTS) {
      patchState(store, { selected: item });
    },

    clear() {
      patchState(store, initialState);
    },
  }))
);
```

## Rules
- Always use `patchState(store, {...})` — never mutate state directly.
- Keep `withComputed` for derived values; keep `withMethods` for async actions and simple setters.
- Services are injected as default parameters in `withMethods`, not via `inject()` in setup.
- Use `mapRight` / `mapLeft` from `@sweet-monads/either` — do not use try/catch.
- `providedIn: 'root'` is the default; only scope differently if the store is feature-local.

Place the file at `libs/catalogohoy/<feature>/src/lib/infrastructure/$ARGUMENTS.store.ts`.
