import { Component, effect, input, linkedSignal } from '@angular/core';
import { AvatarModule } from 'primeng/avatar';

@Component({
  selector: 'ui-avatar',
  imports: [AvatarModule],
  template: `
    <p-avatar
      (onImageError)="error()"
      [image]="url()"
      [label]="hasError() ? label()[0] : ''"
      [size]="size()"
      [shape]="shape()"
      [styleClass]="styleClass()"
    />
  `,
})
export class AvatarComponent {
  public static loadingUrl = 'images/shared/loader.svg';
  public readonly label = input('');
  public readonly image = input('');
  public readonly isLoading = input(false);
  public readonly size = input<'normal' | 'large' | 'xlarge'>('normal');
  public readonly shape = input<'circle' | 'square'>('circle');
  public readonly styleClass = input('');

  public readonly url = linkedSignal<string | undefined>(() => this.image());
  public readonly hasError = linkedSignal(() => this.url() === undefined || this.image() === '');

  constructor() {
    effect(() => {
      if (this.isLoading()) {
        this.url.set(AvatarComponent.loadingUrl);
      } else {
        this.url.set(this.image());
      }
    });
  }

  public error() {
    this.url.set('');
    this.hasError.set(true);
  }
}
