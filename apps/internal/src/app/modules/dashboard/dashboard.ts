import { Component } from '@angular/core';
import { IconComponent } from '@ui';

interface SummaryCard {
  label: string;
  value: string;
  icon: string;
  hint: string;
  tone: 'primary' | 'success' | 'warning' | 'info';
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [IconComponent],
  template: `
    <div class="flex flex-col gap-6">
      <header class="flex flex-col gap-1">
        <h1 class="text-2xl font-bold text-grey-700">Panel interno</h1>
        <p class="text-sm text-grey-400">
          Resumen general del estado de la plataforma CatalogoHoy
        </p>
      </header>

      <section
        class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        @for (card of cards; track card.label) {
          <article
            class="flex flex-col gap-3 p-5 bg-white rounded-xl border border-grey-50"
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-grey-400">
                {{ card.label }}
              </span>
              <div
                class="flex items-center justify-center w-9 h-9 rounded-lg"
                [class.bg-primary-50]="card.tone === 'primary'"
                [class.bg-emerald-50]="card.tone === 'success'"
                [class.bg-amber-50]="card.tone === 'warning'"
                [class.bg-sky-50]="card.tone === 'info'"
              >
                <ui-icon
                  [name]="card.icon"
                  size="18"
                  [styleClass]="
                    card.tone === 'primary'
                      ? 'text-primary-500'
                      : card.tone === 'success'
                      ? 'text-emerald-500'
                      : card.tone === 'warning'
                      ? 'text-amber-500'
                      : 'text-sky-500'
                  "
                />
              </div>
            </div>
            <strong class="text-3xl font-bold text-grey-700">
              {{ card.value }}
            </strong>
            <span class="text-xs text-grey-400">{{ card.hint }}</span>
          </article>
        }
      </section>

      <section class="bg-white rounded-xl border border-grey-50 p-6">
        <h2 class="text-base font-semibold text-grey-700 mb-4">
          Bienvenido al sistema interno
        </h2>
        <p class="text-sm text-grey-400 leading-relaxed">
          Desde acá podés gestionar los planes (mensual, trimestral y anual),
          ver los usuarios registrados y administrar los clientes que pagaron
          una suscripción.
        </p>
      </section>
    </div>
  `,
})
export class Dashboard {
  protected readonly cards: SummaryCard[] = [
    {
      label: 'Usuarios totales',
      value: '0',
      icon: 'users',
      hint: 'Cuentas registradas en la plataforma',
      tone: 'primary',
    },
    {
      label: 'Clientes activos',
      value: '0',
      icon: 'check-circle',
      hint: 'Suscripciones vigentes',
      tone: 'success',
    },
    {
      label: 'Por vencer',
      value: '0',
      icon: 'clock',
      hint: 'Suscripciones próximas a vencer',
      tone: 'warning',
    },
    {
      label: 'Ingresos del mes',
      value: '$0',
      icon: 'trending-up',
      hint: 'Cobrado en el mes en curso',
      tone: 'info',
    },
  ];
}
