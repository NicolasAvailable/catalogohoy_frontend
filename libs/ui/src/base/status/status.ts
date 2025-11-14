import { Component, input } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';

@Component({
  selector: 'ui-status',
  imports: [TranslatePipe],
  styles: [
    `
      .success {
        background-color: var(--color-green-500);
      }
      .error {
        background-color: var(--color-red-500);
      }
      .secondary {
        background-color: var(--color-orange-500);
      }
      .primary {
        background-color: var(--color-primary-300);
      }
      .neutral {
        background-color: var(--color-grey-300);
      }
    `,
  ],
  template: `
    <div class="inline-flex justify-center items-center gap-2.5 h-8 px-3 border border-grey-100 rounded-3xl">
      <span class="w-2.5 h-2.5 rounded-full" [class]="severity()"></span>
      <span class="text-grey-500 text-sm font-semibold">{{ label() | translate }}</span>
    </div>
  `,
})
export class StatusComponent {
  public readonly label = input.required<string>();
  public readonly severity = input.required<'success' | 'error' | 'secondary' | 'primary' | 'neutral'>();
  public readonly styleClass = input('');
}
