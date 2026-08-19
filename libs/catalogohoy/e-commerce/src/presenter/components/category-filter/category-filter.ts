import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { TabsModule } from 'primeng/tabs';

interface CategoryPill {
  id: string;
  name: string;
  isViewAll?: boolean;
}

/** Value used for "no filter" on the tab so PrimeNG tabs (which require a
 *  stable identifier per tab) can always represent the current selection. */
const ALL_TAB = '__all__';

@Component({
  selector: 'lib-category-filter',
  imports: [TabsModule, IconComponent, TranslocoPipe],
  templateUrl: './category-filter.html',
  styleUrl: './category-filter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFilter {
  public readonly categories = input<CategoryPill[]>([]);
  /** True cuando el tenant ocultó su "Ver todos": suprime también el tab
   *  sintético (que existe solo para tenants sin la fila seedeada). */
  public readonly suppressAllTab = input<boolean>(false);
  public readonly selectedCategoryId = input<string | null>(null);
  public readonly categorySelect = output<string | null>();
  public readonly searchClick = output<void>();
  public readonly filterClick = output<void>();

  public readonly allTabValue = ALL_TAB;

  /** True when the tenant seeded a "Ver todos" category — if so, we rely on
   *  it instead of rendering a synthetic "All" tab at position 0. */
  public readonly hasViewAllCategory = computed(() =>
    this.categories().some((c) => c.isViewAll)
  );

  /** Tab bound to the active selection. "Ver todos" category OR no filter
   *  both collapse to ALL_TAB. */
  public readonly activeTab = computed(() => {
    const selected = this.selectedCategoryId();
    if (selected === null) return ALL_TAB;
    return selected;
  });

  onTabChange(value: string | number | undefined): void {
    if (!value || value === ALL_TAB) {
      this.categorySelect.emit(null);
      return;
    }
    const id = String(value);
    const category = this.categories().find((c) => c.id === id);
    // Clicking the seeded "Ver todos" tab also means "clear filter".
    if (category?.isViewAll) {
      this.categorySelect.emit(null);
      return;
    }
    this.categorySelect.emit(id);
  }
}
