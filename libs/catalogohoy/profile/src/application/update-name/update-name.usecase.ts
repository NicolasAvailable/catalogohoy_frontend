import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProfileService } from '../../domain';

export type UpdateNameInput = string;
export type UpdateNameOutput = Promise<E.Either<Error, void>>;

export class UpdateNameUseCase extends UseCase<
  UpdateNameInput,
  UpdateNameOutput
> {
  constructor(private readonly profileService: BaseProfileService) {
    super(
      progressBuilder()
        .withStart('Validando...')
        .withComplete('Se actualizó el nombre correctamente')
        .build()
    );
  }

  public async execute(input: UpdateNameInput): UpdateNameOutput {
    this.start();
    const result = await this.profileService.updateName(input);
    this.complete(result);
    return result;
  }
}
