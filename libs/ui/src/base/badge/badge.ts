import { Component, input } from '@angular/core';
import { OverlayBadgeModule } from 'primeng/overlaybadge';

@Component({
  selector: 'ui-badge',
  imports: [OverlayBadgeModule],
  template: `
    <p-overlaybadge
      [value]="value()"
      [severity]="severity()"
      [badgeSize]="size()"
      [styleClass]="'flex items-center justify-center text-sm! ' + styleClass()"
    >
      <ng-content />
    </p-overlaybadge>
  `,
})
export class BadgeComponent {
  public readonly value = input(0);
  public readonly size = input<'small' | 'large' | 'xlarge'>('small');
  public readonly severity = input<'info' | 'success' | 'warn' | 'danger' | 'secondary' | 'contrast'>('danger');
  public readonly styleClass = input('');
}
