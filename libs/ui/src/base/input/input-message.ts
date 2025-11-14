import { Component, input } from '@angular/core';
import { AbstractControl, FormGroup } from '@angular/forms';
import { TranslatePipe } from '@shared/presenter';
import { MessageModule } from 'primeng/message';

@Component({
  selector: 'ui-input-message',
  imports: [MessageModule, TranslatePipe],
  template: `
    @let invalid = this.error() ? this.control()?.errors?.[this.error()] : this.control()?.invalid;
    @if(control()?.touched && control()?.dirty && invalid){
    <p-message severity="error" variant="simple" size="small" [styleClass]="styleClass()">
      {{ text() | translate }}
    </p-message>
    }
  `,
})
export class InputMessageComponent {
  public readonly text = input('');
  public readonly control = input<FormGroup | AbstractControl | null>(null);
  public readonly error = input('');
  public readonly styleClass = input('');
}
