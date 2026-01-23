import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseCategoryService } from '../../domain';

export type DeleteCategoryInput = string;
export type DeleteCategoryOutput = Promise<E.Either<Error, void>>;

export class DeleteCategoryUseCase extends UseCase<
  DeleteCategoryInput,
  DeleteCategoryOutput
> {
  constructor(private readonly categoryService: BaseCategoryService) {
    super(
      progressBuilder()
        .withStart('Eliminando...')
        .withComplete('Se eliminó la categoría correctamente')
        .build()
    );
  }

  public async execute(input: DeleteCategoryInput): DeleteCategoryOutput {
    this.start();
    const result = await this.categoryService.delete(input);
    this.complete(result);
    return result;
  }
}
