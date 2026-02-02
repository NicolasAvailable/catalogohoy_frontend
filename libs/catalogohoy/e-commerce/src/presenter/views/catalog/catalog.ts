import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import {
  IconComponent,
  InputSearchComponent,
  MenuComponent,
  MenuItem,
} from '@ui';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { CartStore, EcommerceStore } from '../../../infrastructure';
import { CategoryFilter } from '../../components/category-filter/category-filter';
import { ProductCard } from '../../components/product-card/product-card';

@Component({
  selector: 'lib-catalog',
  imports: [
    IconComponent,
    ProductCard,
    CategoryFilter,
    MenuComponent,
    InputSearchComponent,
  ],
  templateUrl: './catalog.html',
  styleUrl: './catalog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Catalog implements OnInit, OnDestroy {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cartStore = inject(CartStore);

  public readonly viewMode = signal<'grid' | 'list'>('grid');
  public readonly searchValue = signal('');
  public readonly orderMenu = viewChild.required<MenuComponent>('orderMenu');

  public readonly orderMenuItems = computed<MenuItem[]>(() => [
    {
      label: 'Más recientes',
      command: () => this.setOrder(null),
      styleClass: 'text-sm text-grey-300! font-bold',
    },
    {
      label: 'Nombre',
      command: () => this.setOrder('name'),
      styleClass: 'text-sm text-grey-300! font-bold',
    },
    {
      label: 'Menor precio',
      command: () => this.setOrder('price_asc'),
      styleClass: 'text-sm text-grey-300! font-bold',
    },
    {
      label: 'Mayor precio',
      command: () => this.setOrder('price_desc'),
      styleClass: 'text-sm text-grey-300! font-bold',
    },
  ]);

  private readonly searchSubject = new Subject<string>();
  private readonly destroy$ = new Subject<void>();
  private slug: string | null = null;

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

  setViewMode(mode: 'grid' | 'list') {
    this.viewMode.set(mode);
  }

  toggleOrderMenu(event: Event) {
    this.orderMenu().toggle(event);
  }

  setOrder(order: 'name' | 'price_asc' | 'price_desc' | null) {
    this.ecommerceStore.setOrderBy(order);
    if (this.slug) {
      this.ecommerceStore.loadProducts(this.slug);
    }
  }

  onCategorySelect(categoryId: string | null) {
    this.ecommerceStore.setSelectedCategory(categoryId);
    if (this.slug) {
      this.ecommerceStore.loadProducts(this.slug);
    }
  }

  getOrderLabel(): string {
    const order = this.ecommerceStore.orderBy();
    switch (order) {
      case 'name':
        return 'Nombre';
      case 'price_asc':
        return 'Menor precio';
      case 'price_desc':
        return 'Mayor precio';
      default:
        return 'Ordenar por';
    }
  }
}
