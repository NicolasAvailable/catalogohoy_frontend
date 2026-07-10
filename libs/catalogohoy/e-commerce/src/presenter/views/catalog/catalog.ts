import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent, InputSearchComponent } from '@ui';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { Category } from '../../../domain';
import { CategoryFilter } from '../../components/category-filter/category-filter';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'lib-catalog',
  imports: [
    IconComponent,
    ProductCard,
    CategoryFilter,
    InputSearchComponent,
    TranslocoPipe,
  ],
  templateUrl: './catalog.html',
  styleUrl: './catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Catalog implements OnInit, OnDestroy {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cartStore = inject(CartStore);

  public readonly searchValue = signal('');
  public readonly showCategoriesSheet = signal(false);
  public readonly showSearch = signal(false);
  public readonly scrollSentinel = viewChild<ElementRef<HTMLDivElement>>('scrollSentinel');

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private slug: string | null = null;
  private observer: IntersectionObserver | null = null;

  constructor() {
    effect(() => {
      const sentinel = this.scrollSentinel();
      this.observer?.disconnect();

      if (sentinel) {
        this.observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting && this.slug) {
              this.ecommerceStore.loadMoreProducts(this.slug);
            }
          },
          { rootMargin: '200px' }
        );
        this.observer.observe(sentinel.nativeElement);
      }
    });

  }

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
    this.observer?.disconnect();
  }

  onSearch(value: string) {
    this.searchValue.set(value);
    this.searchSubject.next(value);
  }

  onCategorySelect(categoryId: string | null) {
    this.ecommerceStore.setSelectedCategory(categoryId);
    if (this.slug) {
      this.ecommerceStore.loadProducts(this.slug);
    }
  }

  toggleSearch() {
    this.showSearch.update((v) => !v);
  }

  openCategoriesSheet() {
    this.showCategoriesSheet.set(true);
  }

  closeCategoriesSheet() {
    this.showCategoriesSheet.set(false);
  }

  onSheetCategorySelect(category: Category) {
    this.onCategorySelect(category.isViewAll ? null : category.id);
    this.closeCategoriesSheet();
  }

  isActiveCategory(category: Category): boolean {
    const selected = this.ecommerceStore.selectedCategoryId();
    if (category.isViewAll) return selected === null;
    return selected === category.id;
  }
}
