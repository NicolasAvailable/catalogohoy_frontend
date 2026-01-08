import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProductService, CreateProductInput } from '../../domain';

export type CreateProductOutput = Promise<E.Either<Error, void>>;

export class CreateProductUseCase extends UseCase<
  CreateProductInput,
  CreateProductOutput
> {
  constructor(private readonly productService: BaseProductService) {
    super(
      progressBuilder()
        .withStart('Validando...')
        .withComplete('Se creó el producto correctamente')
        .build()
    );
  }

  public async execute(input: CreateProductInput): CreateProductOutput {
    this.start();
    const result = await this.productService.create(input);
    this.complete(result);
    return result;
  }
}
