import { WritableSignal } from '@angular/core';

export class SignalList<T> {
  constructor(private readonly signal: WritableSignal<T[]>) {}

  public get values(): T[] {
    return this.signal();
  }

  public insert(value: T): void {
    this.signal.update((oldValue) => [...oldValue, value]);
  }

  public remove(value: T): void {
    this.signal.update((oldValue) => oldValue.filter((item) => item !== value));
  }
}

export const list = <T>(signal: WritableSignal<T[]>) => new SignalList(signal);
