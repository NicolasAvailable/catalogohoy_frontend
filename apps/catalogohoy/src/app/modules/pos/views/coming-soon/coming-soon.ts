import {
  ChangeDetectionStrategy,
  Component,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';

/**
 * Placeholder de las secciones del POS que todavía no están construidas
 * (Movimientos de caja, Devoluciones, Caja, Estadísticas). El título/ícono/texto
 * llegan por `data` de la ruta. Se reemplazan por su vista real en las próximas
 * fases (ver plan CAT-63).
 */
@Component({
  selector: 'pos-coming-soon',
  standalone: true,
  imports: [IconComponent, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="cs">
      <div class="cs-badge">
        <ui-icon [name]="icon" styleClass="size-8" />
      </div>
      <h2>{{ title | transloco }}</h2>
      <p>{{ desc | transloco }}</p>
      <span class="cs-tag">{{ 'Próximamente' | transloco }}</span>
    </div>
  `,
  styles: [
    `
      :host {
        display: grid;
        place-items: center;
        height: 100%;
        background: var(--pos-bg, #f4f5f8);
      }
      .cs {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.5rem;
        text-align: center;
        padding: 2rem;
        color: var(--pos-text-soft, #6b7280);
      }
      .cs-badge {
        display: grid;
        place-items: center;
        width: 4.5rem;
        height: 4.5rem;
        border-radius: 1.25rem;
        background: rgba(30, 67, 192, 0.12);
        color: #1e43c0;
        margin-bottom: 0.5rem;
      }
      .cs h2 {
        font-size: 1.4rem;
        font-weight: 800;
        color: var(--pos-text, #1f2430);
      }
      .cs p {
        max-width: 24rem;
        font-size: 0.95rem;
      }
      .cs-tag {
        margin-top: 0.5rem;
        padding: 0.35rem 0.85rem;
        border-radius: 999px;
        background: rgba(30, 67, 192, 0.12);
        color: #1e43c0;
        font-size: 0.8rem;
        font-weight: 700;
      }
    `,
  ],
})
export default class PosComingSoon {
  private readonly data = inject(ActivatedRoute).snapshot.data;
  readonly title = (this.data['title'] as string) ?? 'Sección';
  readonly icon = (this.data['icon'] as string) ?? 'sparkles';
  readonly desc =
    (this.data['desc'] as string) ??
    'Esta sección estará disponible muy pronto.';
}
