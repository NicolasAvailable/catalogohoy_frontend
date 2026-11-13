import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { IconComponent } from '@ui';
import {
  acquisitionLabel,
  PAY_SOURCE_CLASS,
  PAY_SOURCE_ICON,
  PAY_SOURCE_LABEL,
  PLATFORM_LABEL,
  providerLabel,
  TenantOrigin,
} from './origin.model';

/**
 * Muestra de dónde viene un cliente.
 *  - `compact`: para celdas de tabla (badge de pago + registro en una línea).
 *  - completo: bloque con todos los datos para los detalles.
 */
@Component({
  selector: 'app-origin-badges',
  standalone: true,
  imports: [IconComponent, DatePipe],
  template: `
    @let o = origin();
    @if (compact()) {
      @if (o) {
        <div class="flex flex-col gap-1 items-start">
          @if (o.paySource) {
            <span
              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap {{ payClass[o.paySource] }}"
            >
              <ui-icon [name]="payIcon[o.paySource]" size="12" />
              {{ payLabel[o.paySource] }}
            </span>
          }
          <span class="text-xs text-grey-400 whitespace-nowrap">
            Registro: {{ o.signupPlatform ? platformLabel[o.signupPlatform] : 'sin dato' }}@if (provider(o)) {
              · {{ provider(o) }}
            }
          </span>
          @if (acquisition(o)) {
            <span class="text-xs text-grey-400 truncate max-w-48" [title]="acquisition(o)">
              Vino de: {{ acquisition(o) }}
            </span>
          }
        </div>
      } @else {
        <span class="text-xs text-grey-300">—</span>
      }
    } @else {
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div class="flex flex-col gap-0.5">
          <span class="text-xs uppercase tracking-wide text-grey-400 font-semibold">Paga por</span>
          @if (o?.paySource; as src) {
            <span class="inline-flex items-center gap-1 self-start px-2 py-0.5 rounded-md text-xs font-semibold {{ payClass[src] }}">
              <ui-icon [name]="payIcon[src]" size="12" />
              {{ payLabel[src] }}
              @if (src === 'manual' && o?.manualPaymentMethod) {
                ({{ o?.manualPaymentMethod }})
              }
            </span>
            @if (o?.payStatus) {
              <span class="text-xs text-grey-400">Estado en la tienda: {{ o?.payStatus }}</span>
            }
          } @else {
            <span class="text-grey-500">No paga (gratis)</span>
          }
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs uppercase tracking-wide text-grey-400 font-semibold">Se registró desde</span>
          <span class="text-grey-700">
            {{ o?.signupPlatform ? platformLabel[o!.signupPlatform!] : 'Sin dato (antes de dic 2025)' }}
          </span>
          @if (o?.ownerSignupAt) {
            <span class="text-xs text-grey-400">{{ o?.ownerSignupAt | date: 'dd/MM/yyyy' }}</span>
          }
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs uppercase tracking-wide text-grey-400 font-semibold">Entró con</span>
          <span class="text-grey-700">{{ (o && provider(o)) || '—' }}</span>
        </div>
        <div class="flex flex-col gap-0.5">
          <span class="text-xs uppercase tracking-wide text-grey-400 font-semibold">Cómo nos encontró</span>
          <span class="text-grey-700">{{ (o && acquisition(o)) || 'Sin dato' }}</span>
          @if (o?.referredByName || o?.referredByTenantId) {
            <span class="text-xs text-grey-400">
              Referido por {{ o?.referredByName || '#' + o?.referredByTenantId }}
            </span>
          }
        </div>
      </div>
    }
  `,
})
export class OriginBadges {
  readonly origin = input<TenantOrigin | null>(null);
  readonly compact = input(false);

  protected readonly payLabel = PAY_SOURCE_LABEL;
  protected readonly payIcon = PAY_SOURCE_ICON;
  protected readonly payClass = PAY_SOURCE_CLASS;
  protected readonly platformLabel = PLATFORM_LABEL;

  protected provider(o: TenantOrigin): string | null {
    return providerLabel(o.signupProvider);
  }

  protected acquisition(o: TenantOrigin): string | null {
    return acquisitionLabel(o);
  }
}
