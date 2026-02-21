Create a standalone Angular component for: $ARGUMENTS

Determine from context whether this is a **view** (routed page) or a **component** (reusable/dumb).

## View template (views/$ARGUMENTS.view.ts)
```typescript
import { Component, inject, OnInit, signal } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import { $ARGUMENTSStore } from '../../infrastructure/$ARGUMENTS.store';

@Component({
  selector: 'app-$ARGUMENTS-view',
  standalone: true,
  imports: [TranslocoModule],
  template: `
    <div class="flex flex-col gap-4 p-4">
      @if (store.loading()) {
        <p>{{ 'common.loading' | transloco }}</p>
      }
      @if (store.hasError()) {
        <p class="text-red-500">{{ store.error() }}</p>
      }
      @for (item of store.items(); track item.id) {
        <div>{{ item | json }}</div>
      }
    </div>
  `,
})
export class $ARGUMENTSView implements OnInit {
  protected readonly store = inject($ARGUMENTSStore);

  ngOnInit() {
    const slug = localStorage.getItem('slug') ?? '';
    this.store.loadAll(slug);
  }
}
```

## Reusable component template (components/$ARGUMENTS.component.ts)
```typescript
import { Component, input, output } from '@angular/core';
import { TranslocoModule } from '@jsverse/transloco';
import type { $ARGUMENTS } from '../../domain/$ARGUMENTS.model';

@Component({
  selector: 'app-$ARGUMENTS',
  standalone: true,
  imports: [TranslocoModule],
  template: `
    <div class="...">
      <!-- component template -->
    </div>
  `,
})
export class $ARGUMENTSComponent {
  readonly item = input.required<$ARGUMENTS>();
  readonly selected = output<$ARGUMENTS>();
}
```

## Rules
- Use `@if`, `@for`, `@switch` (Angular 17+ control flow) — never `*ngIf` / `*ngFor`
- Use `input()` / `output()` signal-based API — not `@Input()` / `@Output()`
- Use `inject()` — not constructor injection
- TailwindCSS classes in template — no inline styles
- PrimeNG components where appropriate (buttons, inputs, tables)
- i18n via `transloco` pipe for all user-visible strings
