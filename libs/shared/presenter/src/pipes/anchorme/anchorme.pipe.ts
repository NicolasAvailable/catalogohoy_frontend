import { Pipe, PipeTransform } from '@angular/core';
import anchorme from 'anchorme';

@Pipe({ name: 'anchorme' })
export class AnchormePipe implements PipeTransform {
  transform(input: string): string {
    return anchorme({
      input,
      options: {
        attributes: {
          target: '_blank',
          class: 'anchorme',
        },
      },
    });
  }
}
