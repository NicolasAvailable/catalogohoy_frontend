import { Component, input } from '@angular/core';
import { MessageModule } from 'primeng/message';

type MessageSeverity = 'success' | 'info' | 'warn' | 'error' | 'secondary' | 'contrast';
type MessageVariant = 'text' | 'outlined' | 'simple' | undefined;
type MessageSize = 'small' | 'large' | undefined;

@Component({
  selector: 'ui-message',
  imports: [MessageModule],
  template: `
    <p-message
      [text]="text()"
      [severity]="severity()"
      [variant]="variant()"
      [size]="size()"
      [styleClass]="styleClass()"
      [closable]="false"
      [escape]="false"
    >
      <div class="flex items-start gap-5">
        <ng-content select="[icon]" />
        <ng-content />
      </div>
    </p-message>
  `,
})
export class MessageComponent {
  public readonly text = input<string>('');
  public readonly severity = input<MessageSeverity>('info');
  public readonly variant = input<MessageVariant>(undefined);
  public readonly size = input<MessageSize>(undefined);
  public readonly styleClass = input('');
}
