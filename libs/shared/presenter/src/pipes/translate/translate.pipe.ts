import { Pipe, PipeTransform } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

@Pipe({ name: 'translate', pure: false })
export class TranslatePipe extends TranslocoPipe implements PipeTransform {}
