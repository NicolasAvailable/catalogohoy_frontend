import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProductService } from '../../domain';

export type DuplicateProductInput = string;
export type DuplicateProductOutput = Promise<E.Either<Error, string>>;

export class DuplicateProductUseCase extends UseCase<
  DuplicateProductInput,
  DuplicateProductOutput
> {
  constructor(private readonly productService: BaseProductService) {
    super(
      progressBuilder()
        .withStart('Duplicando...')
        .withComplete('Producto duplicado correctamente')
        .build()
    );
  }

  public async execute(input: DuplicateProductInput): DuplicateProductOutput {
    this.start();
    const result = await this.productService.duplicate(input);
    this.complete(result);
    return result;
  }
}
