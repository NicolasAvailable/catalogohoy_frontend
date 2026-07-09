import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';

@Component({
  selector: 'lib-catalog-expired',
  standalone: true,
  imports: [IconComponent, TranslocoPipe],
  template: `
    <div
      class="fixed inset-0 z-50 bg-white flex items-center justify-center p-6"
    >
      <div class="flex flex-col items-center text-center max-w-md">
        <div
          class="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mb-6"
        >
          <ui-icon name="store" styleClass="size-10 text-primary-500" />
        </div>

        <h1 class="text-2xl font-bold text-grey-700 mb-3">
          {{ 'Catálogo no disponible' | transloco }}
        </h1>

        <p class="text-grey-300 text-base leading-relaxed">
          {{
            'Este catálogo se encuentra temporalmente fuera de servicio. Por favor, intenta más tarde.'
              | transloco
          }}
        </p>

        <div
          class="mt-8 flex items-center gap-2 px-4 py-2 bg-primary-50 rounded-lg"
        >
          <ui-icon
            name="triangle-alert"
            styleClass="size-4 text-primary-500"
          />
          <span class="text-sm text-primary-600 font-medium"
            >{{ 'Catálogo suspendido' | transloco }}</span
          >
        </div>
      </div>
    </div>
  `,
})
export class CatalogExpiredComponent {}
