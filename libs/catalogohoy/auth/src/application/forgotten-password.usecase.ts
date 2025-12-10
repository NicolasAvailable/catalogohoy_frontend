import { UseCase, progressBuilder } from '@shared/application';
import { E } from '@shared/domain';
import {
  BaseAuthenticationService,
  ForgottenPasswordCredentials,
} from '../domain';

export class ForgottenPasswordUseCase extends UseCase<
  ForgottenPasswordCredentials,
  Promise<E.Either<Error, void>>
> {
  constructor(
    private readonly authenticationService: BaseAuthenticationService
  ) {
    super(
      progressBuilder()
        .withStart('Validando...')
        .withComplete(
          'Se envio un correo con un enlace para restablecer tu contraseña'
        )
        .build()
    );
  }

  public async execute(
    input: ForgottenPasswordCredentials
  ): Promise<E.Either<Error, void>> {
    this.start();
    const result = await this.authenticationService.forgottenPassword(input);
    this.complete(result);
    return result;
  }
}
