import { inject, Injectable } from '@angular/core';
import { CreateCategoryInput, UpdateCategoryInput } from '../domain';
import { CategoryService } from '../infrastructure';
import { CreateCategoryUseCase } from './create-category/create-category.usecase';
import { DeleteCategoryUseCase } from './delete-category/delete-category.usecase';
import { GetByIdUseCase } from './get-by-id/get-by-id.usecase';
import { UpdateCategoryUseCase } from './update-category/update-category.usecase';

@Injectable({ providedIn: 'root' })
export class CategoryFacade {
  private readonly categoryService = inject(CategoryService);

  public create(input: CreateCategoryInput) {
    return new CreateCategoryUseCase(this.categoryService).execute(input);
  }

  public getById(id: string) {
    return new GetByIdUseCase(this.categoryService).execute(id);
  }

  public update(input: UpdateCategoryInput) {
    return new UpdateCategoryUseCase(this.categoryService).execute(input);
  }

  public delete(id: string) {
    return new DeleteCategoryUseCase(this.categoryService).execute(id);
  }
}
