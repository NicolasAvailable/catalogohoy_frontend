import { Pipe, PipeTransform } from '@angular/core';
import { $string } from '@shared/domain';

@Pipe({ name: 'capitalize' })
export class CapitalizePipe implements PipeTransform {
  transform(value: string): string {
    return $string.capitalize(value);
  }
}
