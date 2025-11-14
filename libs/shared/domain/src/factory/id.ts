import { randUuid } from '@ngneat/falso';

export class IdFactory {
  public static create(): string {
    return randUuid();
  }
}
