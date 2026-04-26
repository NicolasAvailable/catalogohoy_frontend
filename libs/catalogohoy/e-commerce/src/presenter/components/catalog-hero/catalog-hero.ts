import {
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  signal,
  viewChild,
} from '@angular/core';
import { EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-catalog-hero',
  standalone: true,
  templateUrl: './catalog-hero.html',
  styleUrl: './catalog-hero.css',
})
export class CatalogHero implements OnDestroy {
  readonly ecommerceStore = inject(EcommerceStore);

  readonly showDetails = signal(false);

  /** Approximate character count above which the description is long enough
   *  to spill past 3 lines in the hero card and therefore needs the toggle. */
  private readonly DESCRIPTION_TOGGLE_THRESHOLD = 120;

  /** True when the description is long enough to warrant the
   *  "Mostrar más / Mostrar menos" toggle. */
  readonly canToggleDescription = computed(() => {
    const desc = this.ecommerceStore.effectiveCatalogInfo()?.description?.trim() ?? '';
    return desc.length > this.DESCRIPTION_TOGGLE_THRESHOLD;
  });

  readonly locationText = computed(() => {
    const info = this.ecommerceStore.effectiveCatalogInfo();
    if (!info) return '';
    return [info.city, info.state, info.country].filter(Boolean).join(', ');
  });

  /** True when the modal would actually have something to render. Drives
   *  visibility of the "Ver Más" trigger button to avoid opening an empty
   *  dialog. */
  readonly hasMoreInfo = computed(() => {
    const info = this.ecommerceStore.effectiveCatalogInfo();
    if (!info) return false;
    const hasDescription = !!info.description?.trim();
    const hasHours = (info.businessHoursWeek?.length ?? 0) > 0;
    const hasSocial = [
      info.socialLinks?.instagram,
      info.socialLinks?.facebook,
      info.socialLinks?.tiktok,
    ].some((l) => l?.visible && l?.url);
    return hasDescription || hasHours || hasSocial;
  });

  /**
   * Reference to the `.hero__profile` wrapper that contains the centred
   * logo + store name. When this element scrolls out of the viewport,
   * the navbar shows the logo with an entrance animation.
   */
  private readonly profileRef = viewChild<ElementRef>('heroProfile');
  private observer: IntersectionObserver | null = null;

  constructor() {
    effect(() => {
      const el = this.profileRef()?.nativeElement;
      this.observer?.disconnect();

      if (!el) {
        return;
      }

      // The sticky navbar (~64px) covers the logo before it truly
      // leaves the viewport. A negative rootMargin top accounts for
      // that, triggering the transition as soon as the navbar starts
      // to overlap the profile section.
      this.observer = new IntersectionObserver(
        ([entry]) => {
          this.ecommerceStore.setHeroLogoVisible(entry.isIntersecting);
        },
        { threshold: 0, rootMargin: '-64px 0px 0px 0px' }
      );

      this.observer.observe(el);
    });
  }

  toggleDetails(): void {
    this.showDetails.update((v) => !v);
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

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
