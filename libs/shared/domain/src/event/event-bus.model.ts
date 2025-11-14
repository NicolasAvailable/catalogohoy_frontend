import { ReplaySubject } from 'rxjs';
import { DomainEvent } from './base.event';

type EventConstructor<T extends DomainEvent> = { new (...args: any[]): T };

class EventBus {
  private readonly events = new Map<string, ReplaySubject<DomainEvent>>();

  public publish(event: DomainEvent) {
    this.createIfNotExists(event.constructor.name);
    this.events.get(event.constructor.name)?.next(event);
  }

  private createIfNotExists(name: string) {
    if (!this.events.has(name)) {
      this.events.set(name, new ReplaySubject());
    }
  }

  public on<T extends DomainEvent>(event: EventConstructor<T>) {
    this.createIfNotExists(event.name);
    return this.events.get(event.name);
  }
}

const eventBus = new EventBus();

export const bus = {
  publish: (event: DomainEvent) => eventBus.publish(event),
  on: <T extends DomainEvent>(event: EventConstructor<T>) => eventBus.on(event) as unknown as ReplaySubject<T>,
};
