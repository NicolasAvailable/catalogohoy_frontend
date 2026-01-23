import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseCategoryService, UpdateCategoryInput } from '../../domain';

export type UpdateCategoryOutput = Promise<E.Either<Error, void>>;

export class UpdateCategoryUseCase extends UseCase<
  UpdateCategoryInput,
  UpdateCategoryOutput
> {
  constructor(private readonly categoryService: BaseCategoryService) {
    super(
      progressBuilder()
        .withStart('Actualizando...')
        .withComplete('Se actualizó la categoría correctamente')
        .build()
    );
  }

  public async execute(input: UpdateCategoryInput): UpdateCategoryOutput {
    this.start();
    const result = await this.categoryService.update(input);
    this.complete(result);
    return result;
  }
}
