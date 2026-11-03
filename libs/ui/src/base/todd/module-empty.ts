import { Component, computed, input, output } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';
import { ButtonComponent } from '../button/button';
import { IconComponent } from '../icon/icon';
import { ToddComponent, ToddPose } from './todd';

export type ModuleEmptyAccent = 'primary' | 'purple' | 'emerald' | 'amber' | 'rose' | 'sky';

/** Fila de la vista de ejemplo (panel derecho, solo pantallas anchas). */
export interface ModuleEmptyPreviewRow {
  label: string;
  sub?: string;
  value?: string;
  badge?: string;
  /** Clases Tailwind del badge, p. ej. 'bg-emerald-50 text-emerald-700'. */
  badgeClass?: string;
}

const ACCENTS: Record<ModuleEmptyAccent, { panel: string; dot: string; chip: string }> = {
  primary: { panel: 'from-primary-50 to-white', dot: 'bg-primary-400', chip: 'bg-primary-50 text-primary-500' },
  purple: { panel: 'from-purple-50 to-white', dot: 'bg-purple-400', chip: 'bg-purple-50 text-purple-500' },
  emerald: { panel: 'from-emerald-50 to-white', dot: 'bg-emerald-400', chip: 'bg-emerald-50 text-emerald-600' },
  amber: { panel: 'from-amber-50 to-white', dot: 'bg-amber-400', chip: 'bg-amber-50 text-amber-600' },
  rose: { panel: 'from-rose-50 to-white', dot: 'bg-rose-400', chip: 'bg-rose-50 text-rose-500' },
  sky: { panel: 'from-sky-50 to-white', dot: 'bg-sky-400', chip: 'bg-sky-50 text-sky-600' },
};

/**
 * Vista informativa de un módulo vacío (estilo PostHog): Todd + título del
 * módulo + frase + descripción + acciones, y a la derecha (en pantallas
 * anchas) una vista con datos de ejemplo de cómo se verá el módulo.
 * También sirve para "búsqueda sin resultados" (sin preview, `compact`).
 */
@Component({
  selector: 'ui-module-empty',
  imports: [TranslatePipe, ButtonComponent, IconComponent, ToddComponent],
  host: { class: 'block w-full @container' },
  template: `
    <div
      class="w-full grid items-center gap-8 px-5 text-center"
      [class]="layoutClass()"
    >
      <div
        class="flex flex-col items-center w-full max-w-xl mx-auto"
        [class]="hasPreview() ? '@3xl:items-start' : ''"
      >
        <ui-todd [pose]="pose()" [size]="compact() ? 120 : 150" class="mb-3" />

        @if (title()) {
        <div class="flex items-center gap-3">
          @if (icon()) {
          <span class="size-10 rounded-xl flex items-center justify-center shrink-0" [class]="accent().chip">
            <ui-icon [name]="icon()" styleClass="size-5" />
          </span>
          }
          <h2 class="font-extrabold text-grey-800 leading-tight" [class]="compact() ? 'text-xl' : 'text-2xl @3xl:text-4xl'">
            {{ title() | translate }}
          </h2>
        </div>
        }

        @if (headline()) {
        <h3 class="mt-3 font-bold text-grey-700" [class]="compact() ? 'text-base' : 'text-lg @3xl:text-xl'">
          {{ headline() | translate }}
        </h3>
        }

        @if (description()) {
        <p class="mt-2 text-sm text-grey-400 max-w-lg leading-relaxed">{{ description() | translate }}</p>
        }

        @if (cta() || secondaryCta()) {
        <div class="mt-6 flex flex-wrap items-center justify-center gap-3" [class]="hasPreview() ? '@3xl:justify-start' : ''">
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

      @if (hasPreview()) {
      <div
        class="hidden @3xl:flex self-stretch min-h-80 rounded-2xl bg-linear-to-br p-8 items-center justify-center"
        [class]="accent().panel"
      >
        <div class="w-full max-w-sm text-left">
          <p class="flex items-center gap-2 text-sm font-semibold text-grey-600 mb-3">
            <span class="size-2 rounded-full" [class]="accent().dot"></span>
            {{ previewLabel() | translate }}
          </p>
          <div class="bg-white rounded-xl border border-grey-50 shadow-sm overflow-hidden">
            <div class="flex items-center justify-between px-4 py-3 border-b border-grey-50">
              <span class="text-sm font-bold text-grey-700">{{ previewTitle() | translate }}</span>
              <span class="text-[10px] font-semibold text-grey-400 border border-grey-100 rounded px-1.5 py-0.5">
                {{ 'datos de ejemplo' | translate }}
              </span>
            </div>
            @for (row of previewRows(); track $index) {
            <div class="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-grey-50 last:border-b-0">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-grey-700 truncate">{{ row.label | translate }}</p>
                @if (row.sub) {
                <p class="text-xs text-grey-400 truncate">{{ row.sub | translate }}</p>
                }
              </div>
              <div class="flex items-center gap-2 shrink-0">
                @if (row.badge) {
                <span class="text-[11px] font-semibold rounded-full px-2 py-0.5" [class]="row.badgeClass || 'bg-grey-25 text-grey-500'">
                  {{ row.badge | translate }}
                </span>
                }
                @if (row.value) {
                <span class="text-sm font-bold text-grey-800">{{ row.value }}</span>
                }
              </div>
            </div>
            }
          </div>
        </div>
      </div>
      }
    </div>
  `,
})
export class ModuleEmptyComponent {
  public readonly pose = input<ToddPose>('pointing');
  public readonly icon = input('');
  public readonly title = input('');
  public readonly headline = input('');
  public readonly description = input('');
  public readonly cta = input('');
  public readonly ctaIcon = input('circle-plus');
  public readonly secondaryCta = input('');
  public readonly secondaryIcon = input('');
  public readonly accentColor = input<ModuleEmptyAccent>('primary');
  public readonly previewLabel = input('Así se verá');
  public readonly previewTitle = input('');
  public readonly previewRows = input<ModuleEmptyPreviewRow[]>([]);
  /** Versión chica, centrada y sin panel de ejemplo (búsquedas, paneles). */
  public readonly compact = input(false);

  public readonly ctaClick = output<void>();
  public readonly secondaryClick = output<void>();

  protected readonly accent = computed(() => ACCENTS[this.accentColor()]);
  protected readonly hasPreview = computed(() => !this.compact() && this.previewRows().length > 0);
  protected readonly layoutClass = computed(() => {
    if (this.compact()) return 'py-10';
    return this.hasPreview()
      ? 'py-10 @3xl:py-14 @3xl:px-10 @3xl:text-left @3xl:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]'
      : 'py-12';
  });
}
