import { bus, E, EitherBuilder, is } from '@shared/domain';
import { UseCaseProgress } from './models';

export abstract class UseCase<T, K> {
  protected readonly bus = bus;

  constructor(private readonly progress = UseCaseProgress.empty()) {}

  protected start(message: string | null = null): void {
    const result = new EitherBuilder().fromRightBoolean(message).build();
    result.mapLeft(() => this.progress.start());
    result.mapRight(() => UseCaseProgress.startFor(message as string).start());
  }

  protected stop(): void {
    this.complete(E.right(undefined));
  }

  protected complete(result: E.Either<Error, unknown>): void {
    result.mapLeft((error) => UseCaseProgress.completeFor(error).complete());
    result.mapRight((value) => {
      // Si el usecase configuró un mensaje en el progressBuilder, ese gana
      // siempre. Antes esto solo se respetaba cuando el value NO era string,
      // así que cualquier usecase que devolviera un string (p.ej. una URL
      // de redirect en login) sobrescribía el "¡Bienvenido!" del builder
      // y publicaba la URL como texto del toaster.
      if (this.progress.hasCompleteMessage()) {
        this.progress.complete();
        return;
      }
      // Fallback histórico: si el value es string, lo usamos como mensaje.
      // Esto preserva el comportamiento para usecases viejos que no
      // configuraron `withComplete()` y dependen del string del Either.
      const result = is.string(value);
      result.mapLeft(() => this.progress.complete());
      result.mapRight(() => UseCaseProgress.completeFor(value as string).complete());
    });
  }

  public abstract execute(arg: T): K;
}
