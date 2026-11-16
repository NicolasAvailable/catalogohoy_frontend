import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';
import { ButtonComponent } from '../button/button';
import { ToddComponent, ToddPose } from './todd';

/**
 * Vista informativa de un módulo vacío: Todd + título + frase + descripción +
 * acciones, todo centrado. Con `compact` es la versión chica para
 * "búsqueda sin resultados".
 */
@Component({
  selector: 'ui-module-empty',
  imports: [TranslatePipe, ButtonComponent, ToddComponent],
  host: { class: 'block w-full' },
  template: `
    <div
      class="w-full max-w-xl mx-auto flex flex-col items-center text-center px-5"
      [class]="compact() ? 'py-10' : 'py-12'"
    >
      <ui-todd [pose]="pose()" [size]="compact() ? 120 : 160" class="mb-4" />

      @if (title()) {
      <h2 class="font-extrabold text-grey-800 leading-tight" [class]="compact() ? 'text-xl' : 'text-2xl sm:text-3xl'">
        {{ title() | translate }}
      </h2>
      }

      @if (headline()) {
      <h3 class="mt-2 font-bold text-grey-700" [class]="compact() ? 'text-base' : 'text-lg'">
        {{ headline() | translate }}
      </h3>
      }

      @if (description()) {
      <p class="mt-2 text-sm text-grey-400 max-w-md leading-relaxed">{{ description() | translate }}</p>
      }

      @if (cta() || secondaryCta()) {
      <div class="mt-6 flex flex-wrap items-center justify-center gap-3">
        @if (cta()) {
        <ui-button [label]="cta()" [icon]="ctaIcon()" [fluid]="false" (click)="ctaClick.emit()" />
        }
        @if (secondaryCta()) {
        <ui-button
          [label]="secondaryCta()"
          [icon]="secondaryIcon()"
          variant="outlined"
          severity="contrast"
          [fluid]="false"
          (click)="secondaryClick.emit()"
        />
        }
      </div>
      }

      <ng-content />
    </div>
  `,
})
export class ModuleEmptyComponent {
  public readonly pose = input<ToddPose>('pointing');
  public readonly title = input('');
  public readonly headline = input('');
  public readonly description = input('');
  public readonly cta = input('');
  public readonly ctaIcon = input('circle-plus');
  public readonly secondaryCta = input('');
  public readonly secondaryIcon = input('');
  /** Versión chica (búsquedas sin resultados, paneles). */
  public readonly compact = input(false);

  public readonly ctaClick = output<void>();
  public readonly secondaryClick = output<void>();
}
