import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { ImportJobStore } from '../../../infrastructure';

/** Sin avances en este tiempo, un job "running" se cortó (se cerró la app o
 *  la pestaña a mitad del import). */
const STALE_MS = 3 * 60_000;

/** Aviso en Productos con el resultado del último import en segundo plano:
 *  cuántos entraron, cuáles fallaron y por qué. También avisa si un import
 *  quedó a medias porque se cerró la app. */
@Component({
  selector: 'lib-import-job-banner',
  standalone: true,
  imports: [IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (job(); as j) {
    @if (kind() !== 'hidden') {
    <div
      class="mb-3 rounded-2xl border px-4 py-3 text-sm"
      [class.border-green-200]="kind() === 'ok'"
      [class.bg-green-50]="kind() === 'ok'"
      [class.border-amber-200]="kind() !== 'ok'"
      [class.bg-amber-50]="kind() !== 'ok'"
      role="status"
    >
      <div class="flex items-start gap-3">
        <ui-icon
          [name]="kind() === 'ok' ? 'check-circle' : 'triangle-alert'"
          [styleClass]="'w-5 h-5 mt-0.5 shrink-0 ' + (kind() === 'ok' ? 'text-green-600' : 'text-amber-600')"
        />
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-900">{{ title() | transloco }}</p>
          <p class="text-gray-600 mt-0.5">{{ detail() }}</p>
          @if (j.failed.length > 0) {
          <button
            type="button"
            class="mt-1.5 inline-flex items-center gap-1 font-medium text-amber-700 hover:underline cursor-pointer"
            (click)="expanded.set(!expanded())"
          >
            {{ (expanded() ? 'Ocultar errores' : 'Ver qué falló') | transloco }}
            <ui-icon [name]="expanded() ? 'chevron-up' : 'chevron-down'" styleClass="w-4 h-4" />
          </button>
          @if (expanded()) {
          <ul class="mt-2 max-h-60 overflow-auto rounded-xl bg-white border border-amber-100 divide-y divide-amber-50">
            @for (f of j.failed; track $index) {
            <li class="px-3 py-2">
              <span class="font-medium text-gray-900">{{ f.name || '—' }}</span>
              <span class="block text-red-600 text-xs mt-0.5">{{ f.error }}</span>
            </li>
            }
          </ul>
          }
          }
          @if (kind() === 'interrupted') {
          <button
            type="button"
            class="mt-2 inline-flex items-center gap-1 font-semibold text-primary-600 hover:underline cursor-pointer"
            (click)="openImport.emit()"
          >
            <ui-icon name="upload" styleClass="w-4 h-4" />
            {{ 'Importar de nuevo' | transloco }}
          </button>
          }
        </div>
        <button
          type="button"
          class="shrink-0 p-1 rounded-lg text-gray-400 hover:text-gray-600 cursor-pointer"
          [attr.aria-label]="'Cerrar' | transloco"
          (click)="store.dismiss()"
        >
          <ui-icon name="x" styleClass="w-4 h-4" />
        </button>
      </div>
    </div>
    }
    }
  `,
})
export class ImportJobBannerComponent implements OnInit {
  public readonly store = inject(ImportJobStore);
  public readonly openImport = output<void>();
  public readonly job = this.store.latest;
  public readonly expanded = signal(false);

  public readonly kind = computed<'hidden' | 'ok' | 'errors' | 'interrupted'>(() => {
    const j = this.job();
    if (!j) return 'hidden';
    if (j.status === 'running') {
      if (j.id === this.store.activeJobId()) return 'hidden';
      // Uno en curso lo muestra el aviso flotante del hub; acá solo los que
      // quedaron colgados.
      const idle = Date.now() - new Date(j.updatedAt).getTime();
      return idle > STALE_MS ? 'interrupted' : 'hidden';
    }
    return j.errors > 0 || j.status === 'cancelled' ? 'errors' : 'ok';
  });

  public readonly title = computed(() => {
    const j = this.job();
    if (!j) return '';
    const photos = j.source === 'fotos';
    switch (this.kind()) {
      case 'interrupted':
        return photos
          ? 'La subida de fotos se interrumpió'
          : 'La importación se interrumpió';
      case 'errors':
        if (j.status === 'cancelled') {
          return photos ? 'Subida de fotos cancelada' : 'Importación cancelada';
        }
        return photos
          ? 'Subida de fotos terminada con errores'
          : 'Importación terminada con errores';
      default:
        return photos ? 'Subida de fotos terminada' : 'Importación terminada';
    }
  });

  public readonly detail = computed(() => {
    const j = this.job();
    if (!j) return '';
    const file = j.fileName ? `${j.fileName}: ` : '';
    const unit = j.source === 'fotos' ? 'fotos aplicadas' : 'productos importados';
    if (this.kind() === 'interrupted') {
      return j.source === 'fotos'
        ? `${file}se aplicaron ${j.success} de ${j.total} fotos antes de cerrar la app. Vuelve a subir las que faltan.`
        : `${file}se procesaron ${j.processed} de ${j.total} filas antes de cerrar la app. Vuelve a subir el archivo: lo que ya entró se actualiza, no se duplica.`;
    }
    const parts = [`${j.success} ${unit}`];
    if (j.errors > 0) parts.push(`${j.errors} con error`);
    if (j.skipped > 0) parts.push(`${j.skipped} no entraron por el límite de fotos del plan`);
    if (j.status === 'cancelled') parts.push(`de ${j.total}`);
    return `${file}${parts.join(', ')}.`;
  });

  public ngOnInit(): void {
    void this.store.load();
  }
}
