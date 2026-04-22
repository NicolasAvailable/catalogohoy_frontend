import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseCategoryService, Category, CreateCategoryInput } from '../../domain';

export type CreateCategoryOutput = Promise<E.Either<Error, Category>>;

export class CreateCategoryUseCase extends UseCase<
  CreateCategoryInput,
  CreateCategoryOutput
> {
  constructor(private readonly categoryService: BaseCategoryService) {
    super(
      progressBuilder()
        .withStart('Validando...')
        .withComplete('Se creó la categoría correctamente')
        .build()
    );
  }

  public async execute(input: CreateCategoryInput): CreateCategoryOutput {
    this.start();
    const result = await this.categoryService.create(input);
    this.complete(result);
    return result;
  }
}
