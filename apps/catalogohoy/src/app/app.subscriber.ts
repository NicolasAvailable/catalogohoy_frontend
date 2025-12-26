import { inject, Injectable } from '@angular/core';
import { BaseSubscriber, SharedSubscriber } from '@shared/infrastructure';

@Injectable({ providedIn: 'root' })
export class AppSubscriber extends BaseSubscriber {
  private readonly sharedSubscriber = inject(SharedSubscriber);

  protected listen(): void {
    this.sharedSubscriber.init();
  }
}
