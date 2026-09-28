import { UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProductService } from '../../domain';

export type SetProductHiddenInput = { id: string; hidden: boolean };
export type SetProductHiddenOutput = Promise<E.Either<Error, void>>;

/** Oculta/muestra un producto en el catálogo público desde las acciones
 *  rápidas del listado. Sin toasts de progreso propios: el listado muestra
 *  el resultado con su propio mensaje según la dirección del toggle. */
export class SetProductHiddenUseCase extends UseCase<
  SetProductHiddenInput,
  SetProductHiddenOutput
> {
  constructor(private readonly productService: BaseProductService) {
    super();
  }

  public async execute(input: SetProductHiddenInput): SetProductHiddenOutput {
    this.start();
    const result = await this.productService.setHidden(input.id, input.hidden);
    this.complete(result);
    return result;
  }
}
