import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProductService } from '../../domain';

export type DeleteManyProductsInput = string[];
export type DeleteManyProductsOutput = Promise<E.Either<Error, void>>;

export class DeleteManyProductsUseCase extends UseCase<
  DeleteManyProductsInput,
  DeleteManyProductsOutput
> {
  constructor(private readonly productService: BaseProductService) {
    super(
      progressBuilder()
        .withStart('Eliminando productos...')
        .withComplete('Se eliminaron los productos correctamente')
        .build()
    );
  }

  public async execute(input: DeleteManyProductsInput): DeleteManyProductsOutput {
    this.start();
    const result = await this.productService.deleteMany(input);
    this.complete(result);
    return result;
  }
}
