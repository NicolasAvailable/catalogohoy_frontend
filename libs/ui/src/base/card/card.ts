import { Component, input } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'ui-card',
  imports: [CardModule, TranslatePipe],
  template: `
    <p-card
      [header]="header() | translate"
      [styleClass]="
        'h-full border-1 border-grey-50 font-sans ' +
        (fluent() ? ' card--fluent' : ' ') +
        (transparent() ? ' card--transparent' : ' ') +
        styleClass()
      "
    >
      <ng-content />
    </p-card>
  `,
})
export class CardComponent {
  public readonly header = input('');
  public readonly transparent = input(false);
  public readonly fluent = input(false);
  public readonly styleClass = input('');
}
