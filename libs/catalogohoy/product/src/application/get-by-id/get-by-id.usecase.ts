import { UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProductService, Product } from '../../domain';

export type GetByIdOutput = Promise<E.Either<Error, Product>>;

export class GetByIdUseCase extends UseCase<string, GetByIdOutput> {
  constructor(private readonly productService: BaseProductService) {
    super();
  }

  public async execute(id: string): GetByIdOutput {
    return this.productService.getById(id);
  }
}
