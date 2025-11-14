import { WritableSignal } from '@angular/core';
import { when } from '../../either/either.builder';

export const update = <T>(signal: WritableSignal<T>) => {
  return {
    when: (callback: () => void) => when(callback()).map(() => signal.update((current) => current)),
    with(computeFn: () => T) {
      return {
        when: (callback: () => void) => when(callback()).map(() => signal.set(computeFn())),
      };
    },
  };
};
