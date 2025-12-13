import { UseCase, progressBuilder } from '@shared/application';
import { E } from '@shared/domain';
import {
  BaseAuthenticationService,
  LoginCredentials,
  TenantModel,
} from '../domain';

export class LoginUseCase extends UseCase<
  LoginCredentials,
  Promise<E.Either<Error, TenantModel>>
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
  ): Promise<E.Either<Error, TenantModel>> {
    this.start();
    const result = await this.authenticationService.login(input);
    this.complete(result);
    return result;
  }
}
