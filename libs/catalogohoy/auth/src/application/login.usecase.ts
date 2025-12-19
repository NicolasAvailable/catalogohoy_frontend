import { Tenant } from '@catalogohoy/tenant';
import { UseCase, progressBuilder } from '@shared/application';
import { E } from '@shared/domain';
import { BaseAuthenticationService, LoginCredentials } from '../domain';

export class LoginUseCase extends UseCase<
  LoginCredentials,
  Promise<E.Either<Error, Tenant>>
> {
  constructor(
    private readonly authenticationService: BaseAuthenticationService
  ) {
    super(
      progressBuilder()
        .withStart('Validando...')
        .withComplete('¡Bienvenido!')
        .build()
    );
  }

  public async execute(
    input: LoginCredentials
  ): Promise<E.Either<Error, Tenant>> {
    this.start();
    const result = await this.authenticationService.login(input);
    this.complete(result);
    return result;
  }
}
