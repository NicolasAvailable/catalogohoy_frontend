import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { Component, inject, OnInit, signal, ViewChild } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  ConfirmDialogComponent,
  IconComponent,
  InputTextComponent,
  SkeletonListComponent,
  TooltipDirective,
} from '@ui';
import { PaginatorModule } from 'primeng/paginator';
import { CategoryFacade } from '../../../application';
import { Category, CategoryList } from '../../../domain';
import { CategoryStore } from '../../../infrastructure';
import { CategoryService } from '../../../infrastructure/category.service';

@Component({
  selector: 'lib-category-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    ButtonComponent,
    InputTextComponent,
    IconComponent,
    PaginatorModule,
    CardComponent,
    DragDropModule,
    ConfirmDialogComponent,
    SkeletonListComponent,
    TooltipDirective,
  ],
  templateUrl: './list.html',
  styleUrl: './list.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export default class CategoryListComponent implements OnInit {
  public readonly categoryStore = inject(CategoryStore);
  public readonly categoryFacade = inject(CategoryFacade);
  public readonly categoryService = inject(CategoryService);
  public readonly isCreating = signal(false);
  public readonly isSaving = signal(false);
  public readonly createControl = new FormControl('', [Validators.required]);
  public readonly selectedCategory = signal<Category | null>(null);

  @ViewChild(ConfirmDialogComponent)
  public confirmDialog!: ConfirmDialogComponent;

  // Pagination state
  public first = 0;
  public rows = 10;

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    const page = this.first / this.rows + 1;
    this.categoryStore.categoryList$(page, this.rows);
  }

  onPageChange(event: { first?: number; rows?: number }) {
    this.first = event.first ?? 0;
    this.rows = event.rows ?? 10;
    this.loadData();
  }

  public toggleCreate() {
    this.isCreating.set(true);
  }

  public cancelCreate() {
    this.isCreating.set(false);
    this.createControl.reset();
  }

  public async saveCreate() {
    if (this.createControl.invalid || !this.createControl.value || this.isSaving()) return;

    this.isSaving.set(true);
    const name = this.createControl.value;
    const result = await this.categoryFacade.create({
      name,
      isVisible: true,
    });

    result.mapRight(() => {
      this.cancelCreate();
      this.loadData();
    });
    this.isSaving.set(false);
  }

  public onDelete(category: Category) {
    this.selectedCategory.set(category);
    this.confirmDialog.warning();
  }

  public async onConfirmDelete() {
    const category = this.selectedCategory();
    if (!category || this.isSaving()) return;

    this.isSaving.set(true);
    const result = await this.categoryFacade.delete(String(category.id));
    result.mapRight(() => {
      this.loadData();
    });
    this.isSaving.set(false);
  }

  public async drop(event: CdkDragDrop<Category[]>) {
    if (event.previousIndex === event.currentIndex) return;

    const categories = [...this.categoryStore.categoryList().categories];
    const movedItem = categories.splice(event.previousIndex, 1)[0];
    categories.splice(event.currentIndex, 0, movedItem);

    this.categoryStore.set(CategoryList.from(categories));
    // Pass `first` (the global index of this page's first item) so the
    // service writes positions like 10, 11, 12, … on page 2 instead of
    // 0, 1, 2, … which would clobber page 1.
    await this.categoryService.updatePositions(categories, this.first);
  }
}
