import { Injectable, inject } from '@angular/core';
import { RequestFailedEvent, RequestStartedEvent, RequestSuccessfulEvent, has } from '@shared/domain';
import { ToastService } from '../../services';
import { LoaderStore } from '../../store/loader/loader.store';
import { BaseSubscriber } from '../base.subscriber';

@Injectable({ providedIn: 'root' })
export class RequestSubscriber extends BaseSubscriber {
  private readonly loaderStore = inject(LoaderStore);
  private readonly toastService = inject(ToastService);

  protected listen() {
    this.bus.on(RequestStartedEvent).subscribe(({ message }) => {
      this.loaderStore.enable();
      has(message).mapRight(() => this.toastService.wait(message));
    });

    this.bus.on(RequestSuccessfulEvent).subscribe(({ message }) => {
      this.finish();
      has(message).mapRight(() => this.toastService.success(message));
    });

    this.bus.on(RequestFailedEvent).subscribe(({ exception }) => {
      this.finish();
      has(exception).mapRight(() => this.toastService.error(exception));
    });
  }

  private finish() {
    this.toastService.dismissWait();
    this.loaderStore.disable();
  }
}
