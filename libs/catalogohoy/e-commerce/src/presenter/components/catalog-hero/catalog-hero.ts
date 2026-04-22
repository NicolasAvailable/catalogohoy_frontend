import {
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
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

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
