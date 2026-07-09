import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { LanguageSelectorComponent } from '@catalogohoy/core';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent, InputSearchComponent } from '@ui';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { CartStore, EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-catalog-header',
  imports: [
    IconComponent,
    InputSearchComponent,
    LanguageSelectorComponent,
    TranslocoPipe,
  ],
  templateUrl: './catalog-header.html',
  styleUrl: './catalog-header.css',
})
export class CatalogHeader implements OnInit, OnDestroy {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cartStore = inject(CartStore);
  public readonly searchValue = signal('');

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private slug: string | null = null;

  /**
   * For non-classic templates the logo starts in the hero; when the hero
   * scrolls away this flips to `true` so the navbar reveals it.
   * For classic templates the logo is always visible in the navbar.
   */
  public readonly isNavbarLogoVisible = computed(() => {
    const template =
      this.ecommerceStore.effectiveCatalogInfo()?.template;
    if (!template || template === 'classic') return true;
    return !this.ecommerceStore.heroLogoVisible();
  });

  ngOnInit() {
    this.slug = getTenantSlugFromUrl();

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => {
        this.ecommerceStore.setSearchTerm(value);
        if (this.slug) {
          this.ecommerceStore.loadProducts(this.slug);
        }
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSearch(value: string) {
    this.searchValue.set(value);
    this.searchSubject.next(value);
  }
}
