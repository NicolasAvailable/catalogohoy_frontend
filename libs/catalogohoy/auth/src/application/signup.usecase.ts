import { UseCase, progressBuilder } from '@shared/application';
import { E } from '@shared/domain';
import { BaseAuthenticationService, SignUpCredentials } from '../domain';

export class SignupUseCase extends UseCase<
  SignUpCredentials,
  Promise<E.Either<Error, string>>
> {
  constructor(
    private readonly authenticationService: BaseAuthenticationService
  ) {
    super(
      progressBuilder()
        .withStart('Validando...')
        .withComplete('¡Se ha creado su catalogo exitosamente!')
        .build()
    );
  }

  public async execute(
    input: SignUpCredentials
  ): Promise<E.Either<Error, string>> {
    this.start();
    const result = await this.authenticationService.signup(input);
    this.complete(result);
    return result;
  }
}
