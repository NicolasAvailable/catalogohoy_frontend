import { UseCase, progressBuilder } from '@shared/application';
import { E } from '@shared/domain';
import { BaseAuthenticationService, GoogleSignupCredentials } from '../domain';

export class CompleteGoogleSignupUseCase extends UseCase<
  GoogleSignupCredentials,
  Promise<E.Either<Error, string>>
> {
  constructor(private readonly service: BaseAuthenticationService) {
    super(
      progressBuilder()
        .withStart('Configurando tu catálogo...')
        .withComplete('¡Catálogo creado exitosamente!')
        .build()
    );
  }

  public async execute(
    input: GoogleSignupCredentials
  ): Promise<E.Either<Error, string>> {
    this.start();
    const result = await this.service.completeGoogleSignup(input);
    this.complete(result);
    return result;
  }
}
