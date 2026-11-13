import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
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
import { CartStore, EcommerceService, EcommerceStore } from '../../../infrastructure';
import { Category, CategoryStats } from '../../../domain';
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

  // ── Opciones de diseño (CAT-103) ─────────────────────────────────────
  private readonly look = computed(() => this.ecommerceStore.effectiveCatalogInfo()?.look ?? null);
  /** Categorías en el orden elegido en el editor (manual = como vienen). */
  private readonly ecommerceService = inject(EcommerceService);
  /** Conteos por categoría; solo se piden si el look los necesita. */
  private readonly categoryStats = signal<CategoryStats | null>(null);
  private statsTenant: string | null = null;
  private readonly loadStats = effect(() => {
    const look = this.look();
    const tenantId = this.ecommerceStore.effectiveCatalogInfo()?.id;
    const needs = !!look && (look.hideEmptyCategories || look.showCategoryCount || look.categoryOrder === 'popular');
    if (!needs || !tenantId || this.statsTenant === String(tenantId)) return;
    this.statsTenant = String(tenantId);
    void this.ecommerceService.getCategoryStats(String(tenantId)).then((r) => r.mapRight((s) => this.categoryStats.set(s)));
  });
  public readonly orderedCategories = computed(() => {
    const look = this.look();
    let cats = this.ecommerceStore.categories();
    const stats = this.categoryStats();
    const isViewAll = (c: { name: string; isViewAll?: boolean }) => !!c.isViewAll || /^ver todos$/i.test(c.name.trim());
    if (look?.hideEmptyCategories && stats) {
      cats = cats.filter((c) => isViewAll(c) || (stats[c.id]?.inStock ?? 0) > 0);
    }
    if (look?.categoryOrder === 'az' || (look?.categoryOrder === 'popular' && stats)) {
      // "Ver todos" (si viene como categoría) se queda primero.
      const viewAll = cats.filter(isViewAll);
      const rest = cats.filter((c) => !isViewAll(c));
      rest.sort(look.categoryOrder === 'az'
        ? (a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
        : (a, b) => (stats?.[b.id]?.total ?? 0) - (stats?.[a.id]?.total ?? 0));
      cats = [...viewAll, ...rest];
    }
    if (look?.showCategoryCount && stats) {
      cats = cats.map((c) => (isViewAll(c) ? c : { ...c, name: `${c.name} (${stats[c.id]?.total ?? 0})` }));
    }
    return cats;
  });
  /** Productos destacados (carrusel arriba), en el orden marcado. */
  public readonly featuredProducts = computed(() => {
    const look = this.look();
    const ids = look?.showFeatured === false ? [] : (look?.featuredIds ?? []);
    if (!ids.length) return [];
    const items = this.ecommerceStore.productList().items;
    const byId = new Map(items.map((p) => [String(p.id), p]));
    return ids.map((id) => byId.get(String(id))).filter((p): p is NonNullable<typeof p> => !!p);
  });
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
        try {
          this.observer = new IntersectionObserver(
            (entries) => {
              if (entries[0].isIntersecting && this.slug) {
                this.ecommerceStore.loadMoreProducts(this.slug);
              }
            },
            { rootMargin: '200px' }
          );
          this.observer.observe(sentinel.nativeElement);
        } catch {
          // Algunos navegadores in-app (Instagram/Facebook) traen un
          // IntersectionObserver roto ("observe is not a function"): caemos a
          // un listener de scroll para que el scroll infinito siga andando.
          this.observer = null;
          this.bindScrollFallback(sentinel.nativeElement);
        }
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
    this.removeScrollFallback?.();
  }

  private removeScrollFallback: (() => void) | null = null;

  private bindScrollFallback(sentinel: HTMLElement) {
    this.removeScrollFallback?.();
    const onScroll = () => {
      const top = sentinel.getBoundingClientRect().top;
      if (top - window.innerHeight < 200 && this.slug) {
        this.ecommerceStore.loadMoreProducts(this.slug);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    this.removeScrollFallback = () =>
      window.removeEventListener('scroll', onScroll);
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
    // Sin "Ver todos" (oculto por el tenant), re-tocar la categoría activa
    // quita el filtro — misma vuelta a "todos" que en los tabs.
    const togglesOff =
      this.ecommerceStore.viewAllHidden() && this.isActiveCategory(category);
    this.onCategorySelect(
      category.isViewAll || togglesOff ? null : category.id
    );
    this.closeCategoriesSheet();
  }

  isActiveCategory(category: Category): boolean {
    const selected = this.ecommerceStore.selectedCategoryId();
    if (category.isViewAll) return selected === null;
    return selected === category.id;
  }
}
