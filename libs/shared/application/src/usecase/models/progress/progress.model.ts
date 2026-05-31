import { bus, Exception, is, RequestFailedEvent, RequestStartedEvent, RequestSuccessfulEvent } from '@shared/domain';

export class UseCaseProgress {
  constructor(private readonly startValue: string, private readonly completeValue: string | Error) {}

  public start(): void {
    bus.publish(new RequestStartedEvent(this.startValue));
  }

  public complete(): void {
    is.error(this.completeValue)
      .mapRight(() => {
        bus.publish(new RequestFailedEvent(this.completeValue as Exception));
      })
      .mapLeft(() => {
        bus.publish(new RequestSuccessfulEvent(this.completeValue as string));
      });
  }

  /** True si el builder configuró un mensaje (texto o Error). Permite a
   *  `base.usecase` saber si tiene que usar el mensaje del builder o caer al
   *  string del value como fallback. */
  public hasCompleteMessage(): boolean {
    if (is.error(this.completeValue).isRight()) return true;
    return typeof this.completeValue === 'string' && this.completeValue !== '';
  }

  public static from({ start, complete }: { start: string; complete: string | Error }): UseCaseProgress {
    return new UseCaseProgress(start, complete);
  }

  public static startFor(value: string): UseCaseProgress {
    return new UseCaseProgress(value, '');
  }

  public static completeFor(value: string | Error): UseCaseProgress {
    return new UseCaseProgress('', value);
  }

  public static empty() {
    return new UseCaseProgress('', '');
  }
}
