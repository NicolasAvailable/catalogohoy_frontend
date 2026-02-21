Create a new feature library in this Nx/Angular monorepo for: $ARGUMENTS

## Steps

1. Run the Nx generator to scaffold the library under `libs/catalogohoy/`:
```bash
nx generate @nx/angular:library $ARGUMENTS --directory=libs/catalogohoy/$ARGUMENTS --standalone --no-interactive
```

2. Inside the generated library, create this exact directory structure:
```
libs/catalogohoy/$ARGUMENTS/src/lib/
├── domain/
│   ├── $ARGUMENTS.model.ts        # TypeScript interfaces / domain models
│   └── $ARGUMENTS.service.ts      # Abstract service interface (Base*)
├── infrastructure/
│   ├── $ARGUMENTS.service.ts      # Concrete implementation using Supabase
│   └── $ARGUMENTS.store.ts        # NgRx Signal Store (signalStore)
└── presenter/
    ├── components/                 # Reusable dumb components
    ├── views/                      # Page/routed components
    └── $ARGUMENTS.routes.ts        # Lazy route array export
```

3. Domain model template (`domain/$ARGUMENTS.model.ts`):
```typescript
export interface $ARGUMENTS {
  id: string;
  // add fields here
}
```

4. Domain service interface template (`domain/$ARGUMENTS.service.ts`):
```typescript
import type { Either } from '@sweet-monads/either';
import type { $ARGUMENTS } from './$ARGUMENTS.model';

export abstract class Base$ARGUMENTSService {
  abstract getAll(slug: string): Promise<Either<Error, $ARGUMENTS[]>>;
}
```

5. Infrastructure service template (`infrastructure/$ARGUMENTS.service.ts`):
```typescript
import { Injectable, inject } from '@angular/core';
import * as E from '@sweet-monads/either';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { Base$ARGUMENTSService } from '../domain/$ARGUMENTS.service';
import type { $ARGUMENTS } from '../domain/$ARGUMENTS.model';

@Injectable({ providedIn: 'root' })
export class $ARGUMENTSService extends Base$ARGUMENTSService {
  private readonly supabase = inject(SupabaseClientProvider).client;

  async getAll(slug: string): Promise<E.Either<Error, $ARGUMENTS[]>> {
    const { data, error } = await this.supabase
      .from('table_name')
      .select('*')
      .eq('slug', slug);

    if (error) return E.left(new Error(error.message));
    return E.right(data as $ARGUMENTS[]);
  }
}
```

6. NgRx Signal Store template (`infrastructure/$ARGUMENTS.store.ts`):
```typescript
import { inject } from '@angular/core';
import { signalStore, withState, withMethods, patchState } from '@ngrx/signals';
import { $ARGUMENTSService } from './$ARGUMENTS.service';
import type { $ARGUMENTS } from '../domain/$ARGUMENTS.model';

interface $ARGUMENTSState {
  items: $ARGUMENTS[];
  loading: boolean;
  error: string | null;
}

const initialState: $ARGUMENTSState = {
  items: [],
  loading: false,
  error: null,
};

export const $ARGUMENTSStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store, service = inject($ARGUMENTSService)) => ({
    async loadAll(slug: string) {
      patchState(store, { loading: true, error: null });
      const result = await service.getAll(slug);
      result.mapRight((items) => patchState(store, { items, loading: false }));
      result.mapLeft((err) => patchState(store, { error: err.message, loading: false }));
    },
  }))
);
```

7. Routes template (`presenter/$ARGUMENTS.routes.ts`):
```typescript
import { Route } from '@angular/router';

export const $ARGUMENTSRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./views/$ARGUMENTS-list.view').then((m) => m.$ARGUMENTSListView),
  },
];
```

8. Update `libs/catalogohoy/$ARGUMENTS/src/index.ts` to export public API:
```typescript
export * from './lib/domain/$ARGUMENTS.model';
export * from './lib/infrastructure/$ARGUMENTS.store';
export * from './lib/presenter/$ARGUMENTS.routes';
```

Use PascalCase for class names, kebab-case for file names. All components must be standalone. Use `inject()` instead of constructor injection.
