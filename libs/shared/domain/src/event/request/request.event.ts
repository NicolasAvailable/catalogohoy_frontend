import { Exception } from '../../exception/base.exception';
import { DomainEvent } from '../base.event';

export class RequestStartedEvent extends DomainEvent {
  constructor(public readonly message: string) {
    super();
  }
}

export class RequestSuccessfulEvent extends DomainEvent {
  constructor(public readonly message: string) {
    super();
  }
}

export class RequestFailedEvent extends DomainEvent {
  constructor(public readonly exception: Exception) {
    super();
  }
}
