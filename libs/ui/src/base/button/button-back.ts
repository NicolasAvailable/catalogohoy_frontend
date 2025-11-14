import { Component, input } from '@angular/core';
import { CommonModule, Location } from '@angular/common';
import { ButtonComponent } from '@ui';

@Component({
  selector: 'ui-button-back',
  imports: [CommonModule, ButtonComponent],
  template: `
    <ui-button
      (click)="back()"
      icon="chevron-left"
      severity="contrast"
      size="large"
      styleClass="rounded-full! w-12 h-12"
      iconStyleClass="w-8! h-8!"
    />
  `,
})
export class ButtonBackComponent {
  public readonly auto = input(true);

  constructor(private readonly location: Location) {}

  public back(): void {
    if (this.auto()) this.location.back();
  }
}
