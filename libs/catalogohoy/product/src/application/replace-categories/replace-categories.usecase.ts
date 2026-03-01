import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProductService, ReplaceCategoriesInput } from '../../domain';

export type ReplaceCategoriesOutput = Promise<E.Either<Error, void>>;

export class ReplaceCategoriesUseCase extends UseCase<
  ReplaceCategoriesInput,
  ReplaceCategoriesOutput
> {
  constructor(private readonly productService: BaseProductService) {
    super(
      progressBuilder()
        .withStart('Asignando categorías...')
        .withComplete('Se asignaron las categorías correctamente')
        .build()
    );
  }

  public async execute(
    input: ReplaceCategoriesInput
  ): ReplaceCategoriesOutput {
    this.start();
    const result = await this.productService.replaceCategories(input);
    this.complete(result);
    return result;
  }
}
