# Project Patterns Reference

Detailed code patterns for this Angular/Nx monorepo. Referenced by slash commands.

---

## Either Monad — Error Handling

```typescript
import * as E from '@sweet-monads/either';

// In a component or store method:
const result = await this.service.getAll(slug);

result
  .mapRight((data) => {
    // success path — data is typed correctly
    patchState(store, { items: data });
  })
  .mapLeft((error) => {
    // error path — error is Error instance
    patchState(store, { error: error.message });
  });

// Unwrapping when you need the value:
if (result.isRight()) {
  const value = result.value; // T
}
```

---

## NgRx Signal Store — Full Pattern

```typescript
import { signalStore, withState, withMethods, withComputed, patchState } from '@ngrx/signals';
import { inject, computed } from '@angular/core';

interface FeatureState {
  items: Item[];
  filter: string;
  loading: boolean;
  error: string | null;
}

const initial: FeatureState = { items: [], filter: '', loading: false, error: null };

export const FeatureStore = signalStore(
  { providedIn: 'root' },
  withState(initial),
  withComputed((store) => ({
    filtered: computed(() =>
      store.items().filter((i) => i.name.includes(store.filter()))
    ),
  })),
  withMethods((store, svc = inject(FeatureService)) => ({
    setFilter(filter: string) { patchState(store, { filter }); },

    async load(slug: string) {
      patchState(store, { loading: true, error: null });
      const res = await svc.getAll(slug);
      res
        .mapRight((items) => patchState(store, { items, loading: false }))
        .mapLeft((err) => patchState(store, { error: err.message, loading: false }));
    },
  }))
);
```

---

## Supabase — Query Patterns

```typescript
// Basic select with slug filter
const { data, error } = await this.supabase
  .from('products')
  .select('id, name, price, category_id')
  .eq('slug', slug)
  .order('name', { ascending: true });

// Join related table
const { data, error } = await this.supabase
  .from('products')
  .select('*, categories(name)')
  .eq('slug', slug);

// Upsert
const { data, error } = await this.supabase
  .from('products')
  .upsert(payload)
  .select()
  .single();

// Always check error first, then cast data:
if (error) return E.left(new Error(error.message));
return E.right(data as YourType);
```

---

## Angular — Template Control Flow

```html
<!-- ✅ Use new control flow (Angular 17+) -->
@if (store.loading()) {
  <p-skeleton />
} @else if (store.hasError()) {
  <p class="text-red-500">{{ store.error() }}</p>
} @else {
  @for (item of store.filtered(); track item.id) {
    <app-item-card [item]="item" (selected)="store.select($event)" />
  } @empty {
    <p>No items found.</p>
  }
}

<!-- ❌ Never use structural directives -->
<div *ngIf="loading">...</div>
<div *ngFor="let item of items">...</div>
```

---

## Angular — Signal-based Inputs/Outputs

```typescript
// ✅ Signal API (Angular 17+)
readonly item = input.required<Product>();
readonly variant = input<'default' | 'compact'>('default');
readonly selected = output<Product>();
readonly deleted = output<string>(); // emits id

// ❌ Old decorator API — do not use
@Input() item!: Product;
@Output() selected = new EventEmitter<Product>();
```

---

## Routing — Lazy Feature with Guards

```typescript
// In app.routes.ts
{
  path: ':slug/admin',
  canActivate: [authenticationGuard],
  loadChildren: () =>
    import('@catalogohoy/e-commerce').then((m) => m.ecommerceRoutes),
},

// In feature routes file
export const ecommerceRoutes: Route[] = [
  {
    path: '',
    loadComponent: () =>
      import('./views/catalog.view').then((m) => m.CatalogView),
  },
  {
    path: 'product/:id',
    loadComponent: () =>
      import('./views/product-detail.view').then((m) => m.ProductDetailView),
  },
];
```

---

## i18n — Transloco (key-as-text, 4 idiomas)

**Convención: la key ES el texto en español** (estilo gettext) — NO keys semánticas.
Idiomas: `es` (fuente) / `en` / `fr` / `pt` (pt-BR). Implementado 2026-07-09 (CAT-6).

```typescript
// Template: texto visible
{{ 'Guardar cambios' | transloco }}
// Atributos
[placeholder]="'Buscar producto' | transloco"
// Con parámetros: UNA llave {param} (interpolation: ['{','}'] — con {{ }} la key
// rompería el parser de templates de Angular)
{{ 'Vence en {days} días' | transloco: { days: days() } }}
// TS
import { translate } from '@jsverse/transloco';
const label = translate('Guardar cambios');
```

Reglas clave:
- Cada componente standalone que use el pipe necesita `TranslocoPipe` en `imports`.
- **Toasts (`ToastService`/sonner), `ConfirmDialogService` y varios @ui (`ui-button`
  label, `ui-input-text`/`ui-input-search` placeholder, `ui-tabs`, `ui-dialog`
  headerTitle) traducen SOLOS sus textos** → los call sites pasan español plano;
  solo hay que asegurarse de que el texto exista como key en los JSON.
- Key faltante ⇒ transloco devuelve la key ⇒ se ve español (degradación segura).
- `KeepParamsTranspiler` (core) conserva placeholders sin resolver — no borrar
  (lo necesita el paginador de PrimeNG).
- Selector de idioma: `<lib-language-selector />` (`@catalogohoy/core`), persiste
  en localStorage (`catalogohoy_lang`) + auto-detección `navigator.language`.
  `LOCALE_ID` se resuelve al bootstrap con el mismo valor (fechas/números).
- Los 4 JSON viven en `apps/<app>/public/i18n/*.json` y **deben mantenerse
  iguales entre las 3 apps** (hoy: copiar el de catalogohoy). Paridad de keys:
  `node scripts/i18n-check.mjs` (falla si en/fr/pt driftean de es.json).
- Al agregar texto nuevo: agregar la key (=texto es) a `es.json` + su traducción
  en `en/fr/pt.json` de las 3 apps. Contenido del tenant NO se traduce.

---

## Multi-tenancy — Slug Access

```typescript
// Slug is stored in localStorage from App component
const slug = localStorage.getItem('slug') ?? '';

// In a store method:
async load() {
  const slug = localStorage.getItem('slug') ?? '';
  await this.loadForSlug(slug);
}
```

---

## Path Aliases — Import Conventions

```typescript
// ✅ Always use path aliases for cross-library imports
import { EcommerceStore } from '@catalogohoy/e-commerce';
import { User } from '@shared/domain';
import { ButtonComponent } from '@ui';

// ❌ Never use relative paths across library boundaries
import { EcommerceStore } from '../../../../../../libs/catalogohoy/e-commerce/...';
```

Aliases are defined in `tsconfig.base.json`.
