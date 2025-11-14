import { Component } from '@angular/core';
import { IconComponent } from '../../../icon';
import { TranslatePipe } from '@shared/presenter';

@Component({
  selector: 'ui-empty-results',
  imports: [TranslatePipe, IconComponent],
  templateUrl: './empty-results.component.html',
})
export class EmptyResultsComponent {}
