import { Component, input } from '@angular/core';
import { ButtonComponent } from './button';

@Component({
  selector: 'ui-button-ai',
  imports: [ButtonComponent],
  styles: [':host { flex-shrink: 0; }'],
  template: `
    <div
      class="inline-block rounded-base p-[0.125rem]"
      style="background: linear-gradient(249.16deg, #00AAFF 17.99%, #004AC2 100%);"
    >
      <ui-button
        [label]="label()"
        [variant]="'outlined'"
        [icon]="'images/shared/ai-logo.svg'"
        [size]="size()"
        [disabled]="disabled()"
        [styleClass]="
          'bg-white-500! border-none! hover:bg-[#E5F6FF]! active:bg-[#C9EDFF]! rounded-[0.45rem]! ' + styleClass()
        "
      />
    </div>
  `,
})
export class ButtonAIComponent {
  public readonly label = input('');
  public readonly size = input<'small' | 'large' | undefined>(undefined);
  public readonly disabled = input(false);
  public readonly styleClass = input('');
}
