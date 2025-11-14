import { Component, computed, effect, input, signal } from '@angular/core';
import { sleep } from '@shared/domain';
import { ProgressBarModule } from 'primeng/progressbar';

@Component({
  selector: 'ui-progress-bar',
  imports: [ProgressBarModule],
  template: ` <p-progressbar
    [value]="value()"
    [showValue]="showValue()"
    [hidden]="hidden()"
    [valueStyleClass]="'rounded-full ' + valueStyleClass()"
    [styleClass]="'h-1.5! ' + styleClass()"
  />`,
})
export class ProgressBarComponent {
  public readonly value = input<number>(0);
  public readonly showValue = input<boolean>(false);
  public readonly hiddenCompleted = input<boolean>(false);
  public readonly valueStyleClass = input<string>('');
  public readonly styleClass = input<string>('');

  public readonly hidden = signal(false);

  public readonly isCompleted = computed(() => this.value() === 100);

  constructor() {
    effect(() => {
      if (this.hiddenCompleted() && this.isCompleted()) {
        sleep(1000).then(() => this.hidden.set(true));
      }
    });
  }
}
