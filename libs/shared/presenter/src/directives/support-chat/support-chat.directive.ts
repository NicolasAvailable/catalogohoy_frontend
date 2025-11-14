import { Directive, HostListener, input } from '@angular/core';

declare global {
  interface Window {
    tikket: { setTextBox: (text: string) => void };
  }
}

@Directive({ selector: '[appSupportChat]', exportAs: 'appSupportChat' })
export class SupportChatDirective {
  public readonly appSupportChat = input<string>('');

  @HostListener('click')
  onClick() {
    window.tikket.setTextBox(this.appSupportChat());
  }
}
