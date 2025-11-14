import { signal } from '@angular/core';
import { bus, is, not } from '@shared/domain';

export abstract class BaseSubscriber {
  private readonly isInitialized = signal(false);
  protected readonly bus = bus;

  public init(): void {
    is.affirmative(not(this.isInitialized())).mapRight(() => {
      this.listen();
      this.isInitialized.set(true);
    });
  }

  protected abstract listen(): void;
}
