import { Pipe, PipeTransform } from '@angular/core';

/** Los wa_id de WhatsApp llegan sin '+' ("50237049582"): este pipe antepone el
 *  '+' del código de país para mostrarlos como número internacional. */
@Pipe({ name: 'phonePlus', standalone: true })
export class PhonePlusPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    const v = (value ?? '').trim();
    if (!v) return '';
    return v.startsWith('+') ? v : `+${v}`;
  }
}
