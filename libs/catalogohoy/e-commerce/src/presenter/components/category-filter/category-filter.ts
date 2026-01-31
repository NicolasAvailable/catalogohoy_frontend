import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ButtonComponent } from '@ui';

@Component({
  selector: 'lib-category-filter',
  imports: [ButtonComponent],
  templateUrl: './category-filter.html',
  styleUrl: './category-filter.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryFilter {
  public readonly categories = input<{ id: string; name: string }[]>([]);
  public readonly selectedCategoryId = input<string | null>(null);
  public readonly categorySelect = output<string | null>();

  onCategoryClick(categoryId: string | null) {
    this.categorySelect.emit(categoryId);
  }

  isSelected(categoryId: string | null): boolean {
    return this.selectedCategoryId() === categoryId;
  }
}
