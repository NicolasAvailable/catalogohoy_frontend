import { progressBuilder, UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseProfileService } from '../../domain';

export type UpdatePasswordInput = string;
export type UpdatePasswordOutput = Promise<E.Either<Error, void>>;

export class UpdatePasswordUseCase extends UseCase<
  UpdatePasswordInput,
  UpdatePasswordOutput
> {
  constructor(private readonly profileService: BaseProfileService) {
    super(
      progressBuilder()
        .withStart('Validando...')
        .withComplete('Se actualizó la contraseña correctamente')
        .build()
    );
  }

  public async execute(input: UpdatePasswordInput): UpdatePasswordOutput {
    this.start();
    const result = await this.profileService.updatePassword(input);
    this.complete(result);
    return result;
  }
}
