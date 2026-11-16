import { Component } from '@angular/core';
import { ToddComponent } from '../../../todd/todd';
import { TranslatePipe } from '@shared/presenter';

@Component({
  selector: 'ui-empty-results',
  imports: [TranslatePipe, ToddComponent],
  templateUrl: './empty-results.component.html',
})
export class EmptyResultsComponent {}
