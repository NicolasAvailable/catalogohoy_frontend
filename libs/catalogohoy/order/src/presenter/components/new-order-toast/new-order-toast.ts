import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';

/**
 * Toast in-app a medida para "orden nueva" (se muestra con
 * `toast.custom(NewOrderToastComponent, …)` de ngx-sonner). Diseño compacto:
 * ícono + texto + botón "Ver" con aire + cerrar. Los callbacks (ver/cerrar) y el
 * nombre del cliente llegan como inputs desde OrderBadgeRealtimeService.
 */
@Component({
  selector: 'lib-new-order-toast',
  standalone: true,
  imports: [IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex items-center gap-2.5 w-full rounded-xl bg-white border border-grey-100 shadow-lg shadow-grey-400/25 py-2 pl-2.5 pr-2"
    >
      <span
        class="shrink-0 w-8 h-8 rounded-full bg-primary-50 flex items-center justify-center"
      >
        <ui-icon name="shopping-bag" size="16" styleClass="text-primary-600" />
      </span>
      <div class="flex-1 min-w-0 leading-tight">
        <p class="text-[0.82rem] font-semibold text-grey-800">
          {{ 'Nueva orden recibida' | transloco }}
        </p>
        @if (customerName()) {
        <p class="text-xs text-grey-500 truncate">{{ customerName() }}</p>
        }
      </div>
      <button
        type="button"
        (click)="view()"
        class="shrink-0 rounded-lg bg-primary-500 hover:bg-primary-600 text-white text-[0.8rem] font-semibold px-3.5 py-1.5 transition-colors cursor-pointer"
      >
        {{ 'Ver' | transloco }}
      </button>
      <button
        type="button"
        (click)="dismiss()"
        [attr.aria-label]="'Cerrar' | transloco"
        class="shrink-0 w-6 h-6 rounded-md text-grey-300 hover:text-grey-500 hover:bg-grey-50 flex items-center justify-center transition-colors cursor-pointer"
      >
        <ui-icon name="x" size="14" />
      </button>
    </div>
  `,
})
export class NewOrderToastComponent {
  /** Nombre del cliente que hizo el pedido (opcional). */
  public readonly customerName = input('');
  /** Callback al tocar "Ver" (navega a Órdenes y cierra el toast). */
  public readonly onView = input<() => void>(() => undefined);
  /** Callback al cerrar el toast. */
  public readonly onDismiss = input<() => void>(() => undefined);

  protected view(): void {
    this.onView()();
  }

  protected dismiss(): void {
    this.onDismiss()();
  }
}
