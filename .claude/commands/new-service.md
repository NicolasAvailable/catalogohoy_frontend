Create the domain interface and infrastructure implementation for: $ARGUMENTS

This generates two files following the project's service contract pattern.

---

## File 1 — Domain interface
**Path:** `libs/catalogohoy/<feature>/src/lib/domain/$ARGUMENTS.service.ts`

```typescript
import type { Either } from '@sweet-monads/either';
import type { $ARGUMENTS } from './$ARGUMENTS.model';

/**
 * Abstract contract — import this in components/stores, never the concrete class.
 */
export abstract class Base$ARGUMENTSService {
  abstract getAll(slug: string): Promise<Either<Error, $ARGUMENTS[]>>;
  abstract getById(id: string): Promise<Either<Error, $ARGUMENTS>>;
  abstract create(payload: Omit<$ARGUMENTS, 'id'>): Promise<Either<Error, $ARGUMENTS>>;
  abstract update(id: string, payload: Partial<$ARGUMENTS>): Promise<Either<Error, $ARGUMENTS>>;
  abstract delete(id: string): Promise<Either<Error, void>>;
}
```

---

## File 2 — Infrastructure implementation
**Path:** `libs/catalogohoy/<feature>/src/lib/infrastructure/$ARGUMENTS.service.ts`

```typescript
import { Injectable, inject } from '@angular/core';
import * as E from '@sweet-monads/either';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { Base$ARGUMENTSService } from '../domain/$ARGUMENTS.service';
import type { $ARGUMENTS } from '../domain/$ARGUMENTS.model';

const TABLE = 'your_table_name'; // Replace with actual Supabase table name

@Injectable({ providedIn: 'root' })
export class $ARGUMENTSService extends Base$ARGUMENTSService {
  private readonly supabase = inject(SupabaseClientProvider).client;

  async getAll(slug: string): Promise<E.Either<Error, $ARGUMENTS[]>> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('*')
      .eq('slug', slug);
    if (error) return E.left(new Error(error.message));
    return E.right(data as $ARGUMENTS[]);
  }

  async getById(id: string): Promise<E.Either<Error, $ARGUMENTS>> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .select('*')
      .eq('id', id)
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(data as $ARGUMENTS);
  }

  async create(payload: Omit<$ARGUMENTS, 'id'>): Promise<E.Either<Error, $ARGUMENTS>> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .insert(payload)
      .select()
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(data as $ARGUMENTS);
  }

  async update(id: string, payload: Partial<$ARGUMENTS>): Promise<E.Either<Error, $ARGUMENTS>> {
    const { data, error } = await this.supabase
      .from(TABLE)
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error) return E.left(new Error(error.message));
    return E.right(data as $ARGUMENTS);
  }

  async delete(id: string): Promise<E.Either<Error, void>> {
    const { error } = await this.supabase.from(TABLE).delete().eq('id', id);
    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }
}
```

---

## Rules
- Never use try/catch — Supabase returns `{ data, error }`, map the error to `E.left`.
- Components and stores depend on the **abstract** `Base*Service`, not the concrete class.
- Always return `Either<Error, T>` — never throw from service methods.
- Remove methods from the interface that this specific feature does not need.
