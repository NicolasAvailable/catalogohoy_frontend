import { Exception } from '@shared/domain';

export class TypeNotAcceptedException extends Exception {
  constructor() {
    super('El archivo no es de un tipo permitido');
  }
}

export class MaxSizeExceededError extends Exception {
  constructor(public readonly max: number) {
    super('El archivo excede el tamaño máximo permitido', { max });
  }
}
