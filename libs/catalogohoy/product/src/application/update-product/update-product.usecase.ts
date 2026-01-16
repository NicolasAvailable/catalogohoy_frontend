import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProductService, UpdateProductInput } from '../../domain';

export type UpdateProductOutput = Promise<E.Either<Error, void>>;

export class UpdateProductUseCase extends UseCase<
  UpdateProductInput,
  UpdateProductOutput
> {
  constructor(private readonly productService: BaseProductService) {
    super(
      progressBuilder()
        .withStart('Actualizando...')
        .withComplete('Se actualizó el producto correctamente')
        .build()
    );
  }

  public async execute(input: UpdateProductInput): UpdateProductOutput {
    this.start();
    const result = await this.productService.update(input);
    this.complete(result);
    return result;
  }
}
