import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { IconComponent, InputSearchComponent } from '@ui';
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';
import { CartStore, EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-catalog-header',
  imports: [IconComponent, InputSearchComponent],
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
