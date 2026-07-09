import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { SafeDescriptionHtmlPipe } from '@shared/presenter';
import { EcommerceStore } from '../../../infrastructure';

const DAY_LABELS_ES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];

@Component({
  selector: 'lib-catalog-info-modal',
  standalone: true,
  imports: [IconComponent, SafeDescriptionHtmlPipe, TranslocoPipe],
  templateUrl: './catalog-info-modal.html',
  styleUrl: './catalog-info-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogInfoModal {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly isOpen = computed(() => this.ecommerceStore.isInfoModalOpen());

  /** Expanded panel — null means none open. Mirrors Fatness UX where
   *  one panel is open at a time. */
  public readonly expandedPanel = signal<'hours' | 'description' | 'social' | null>(
    'hours'
  );

  public readonly hasHours = computed(
    () => (this.ecommerceStore.effectiveCatalogInfo()?.businessHoursWeek?.length ?? 0) > 0
  );

  public readonly hasDescription = computed(() => {
    const desc = this.ecommerceStore.effectiveCatalogInfo()?.description;
    return !!desc && desc.trim().length > 0;
  });

  public readonly hasSocial = computed(() => {
    const links = this.ecommerceStore.effectiveCatalogInfo()?.socialLinks;
    if (!links) return false;
    return [links.instagram, links.facebook, links.tiktok].some(
      (l) => l?.visible && l?.url
    );
  });

  /** Today's day index (0 = Sunday). Used to highlight current day in the
   *  schedule table and show the "abre hoy" status banner. */
  public readonly todayIndex = new Date().getDay();

  public readonly orderedHours = computed(() => {
    const week = this.ecommerceStore.effectiveCatalogInfo()?.businessHoursWeek ?? [];
    return [...week].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  });

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        document.body.style.overflow = 'hidden';
        if (this.hasHours()) this.expandedPanel.set('hours');
        else if (this.hasDescription()) this.expandedPanel.set('description');
        else if (this.hasSocial()) this.expandedPanel.set('social');
        else this.expandedPanel.set(null);
      } else {
        document.body.style.overflow = '';
      }
    });
  }

  close(): void {
    this.ecommerceStore.closeInfoModal();
  }

  togglePanel(panel: 'hours' | 'description' | 'social'): void {
    this.expandedPanel.update((current) => (current === panel ? null : panel));
  }

  dayLabel(dayOfWeek: number): string {
    return DAY_LABELS_ES[dayOfWeek] ?? '';
  }

  formatHourAmPm(time: string | null | undefined): string {
    if (!time) return '';
    const [hStr, mStr] = time.split(':');
    const hour = Number(hStr);
    if (Number.isNaN(hour)) return time;
    const minutes = (mStr ?? '00').padStart(2, '0');
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${hour12}:${minutes} ${period}`;
  }
}
