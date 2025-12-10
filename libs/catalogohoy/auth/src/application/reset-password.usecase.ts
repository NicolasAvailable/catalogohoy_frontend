import { UseCase, progressBuilder } from '@shared/application';
import { E } from '@shared/domain';
import { BaseAuthenticationService, ResetPasswordCredentials } from '../domain';

export class ResetPasswordUseCase extends UseCase<
  ResetPasswordCredentials,
  Promise<E.Either<Error, void>>
> {
  constructor(
    private readonly authenticationService: BaseAuthenticationService
  ) {
    super(
      progressBuilder()
        .withStart('Restableciendo contraseña...')
        .withComplete('¡Contraseña restablecida exitosamente!')
        .build()
    );
  }

  public async execute(
    input: ResetPasswordCredentials
  ): Promise<E.Either<Error, void>> {
    this.start();
    const result = await this.authenticationService.resetPassword(input);
    this.complete(result);
    return result;
  }
}
