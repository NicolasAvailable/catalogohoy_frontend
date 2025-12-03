import { UseCase, progressBuilder } from '@shared/application';
import { BaseAuthenticationService, SignUpCredentials } from '../domain';

export class SignupUseCase extends UseCase<SignUpCredentials, Promise<any>> {
  constructor(
    private readonly authenticationService: BaseAuthenticationService
  ) {
    super(
      progressBuilder()
        .withStart('Validando...')
        .withComplete('Bienvenido!')
        .build()
    );
  }

  public async execute(input: SignUpCredentials): Promise<any> {
    this.start();
    const result = await this.authenticationService.signup(input);
    console.log(result);
    this.complete(result);
    return;
  }
}
