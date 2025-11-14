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
      const result = is.string(value);
      result.mapLeft(() => this.progress.complete());
      result.mapRight(() => UseCaseProgress.completeFor(value as string).complete());
    });
  }

  public abstract execute(arg: T): K;
}
