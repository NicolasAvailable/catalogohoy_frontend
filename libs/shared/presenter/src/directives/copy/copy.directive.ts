import { Directive, HostListener, input } from '@angular/core';
import { when } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';

@Directive({ selector: '[appCopy]', exportAs: 'appCopy' })
export class CopyDirective {
  public readonly appCopy = input<string>('');
  public readonly successCopy = input<string>('GLOBAL.SUCCESS_COPY');

  constructor(private readonly toast: ToastService) {}

  @HostListener('click')
  onClick() {
    when(navigator.clipboard.writeText(this.appCopy())).mapRight(() => {
      this.toast.success(this.successCopy());
    });
  }
}
