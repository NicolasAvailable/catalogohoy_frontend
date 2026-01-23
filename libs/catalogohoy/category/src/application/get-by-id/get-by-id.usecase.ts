import { UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseCategoryService, Category } from '../../domain';

export type GetByIdOutput = Promise<E.Either<Error, Category>>;

export class GetByIdUseCase extends UseCase<string, GetByIdOutput> {
  constructor(private readonly categoryService: BaseCategoryService) {
    super();
  }

  public async execute(id: string): GetByIdOutput {
    return this.categoryService.getById(id);
  }
}
