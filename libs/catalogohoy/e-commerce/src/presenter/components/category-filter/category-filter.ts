import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ButtonComponent } from '@ui';

interface CategoryPill {
  id: string;
  name: string;
  isViewAll?: boolean;
}

@Component({
  selector: 'lib-category-filter',
  imports: [ButtonComponent],
  templateUrl: './category-filter.html',
  styleUrl: './category-filter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFilter {
  public readonly categories = input<CategoryPill[]>([]);
  public readonly selectedCategoryId = input<string | null>(null);
  public readonly categorySelect = output<string | null>();

  onCategoryClick(category: CategoryPill) {
    // Clicking the seeded "Ver todos" category always clears the filter.
    if (category.isViewAll) {
      this.categorySelect.emit(null);
      return;
    }

    // When the tenant hid or removed the "Ver todos" category, there's no
    // explicit clear-all pill in the UI. Re-clicking the currently active
    // category acts as a toggle-off and restores the "show all" state.
    const hasViewAll = this.categories().some((c) => c.isViewAll);
    const isCurrentlySelected = this.selectedCategoryId() === category.id;
    if (!hasViewAll && isCurrentlySelected) {
      this.categorySelect.emit(null);
      return;
    }

    this.categorySelect.emit(category.id);
  }

  isSelected(category: CategoryPill): boolean {
    const selected = this.selectedCategoryId();
    if (category.isViewAll) return selected === null;
    return selected === category.id;
  }
}
