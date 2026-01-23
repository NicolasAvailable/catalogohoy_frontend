import { Component, inject, OnInit, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputTextComponent,
} from '@ui';
import { PaginatorModule } from 'primeng/paginator';
import { CategoryFacade } from '../../../application';
import { CategoryStore } from '../../../infrastructure';

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
  public readonly isCreating = signal(false);
  public readonly createControl = new FormControl('', [Validators.required]);

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
    if (this.createControl.invalid || !this.createControl.value) return;

    const name = this.createControl.value;
    const result = await this.categoryFacade.create({
      name,
      isVisible: true,
    });

    result.mapRight(() => {
      this.cancelCreate();
      this.categoryStore.categoryList$();
    });
  }

  public onDelete(id: string | number) {
    if (confirm('¿Estás seguro de eliminar esta categoría?')) {
      this.categoryFacade.delete(String(id)).then((result) => {
        result.mapRight(() => this.categoryStore.categoryList$());
      });
    }
  }
}
