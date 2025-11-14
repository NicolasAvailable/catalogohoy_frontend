import { Injectable } from '@angular/core';
import { BaseSubscriber } from './base.subscriber';
import { RequestSubscriber } from './request/request.subscriber';

@Injectable({ providedIn: 'root' })
export class SharedSubscriber extends BaseSubscriber {
  constructor(private readonly requestSubscriber: RequestSubscriber) {
    super();
  }

  protected listen() {
    this.requestSubscriber.init();
  }
}
