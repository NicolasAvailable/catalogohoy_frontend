import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProductService } from '../../domain';

export type DeleteProductInput = string;
export type DeleteProductOutput = Promise<E.Either<Error, void>>;

export class DeleteProductUseCase extends UseCase<
  DeleteProductInput,
  DeleteProductOutput
> {
  constructor(private readonly productService: BaseProductService) {
    super(
      progressBuilder()
        .withStart('Eliminando...')
        .withComplete('Se eliminó el producto correctamente')
        .build()
    );
  }

  public async execute(input: DeleteProductInput): DeleteProductOutput {
    this.start();
    const result = await this.productService.delete(input);
    this.complete(result);
    return result;
  }
}
