import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@shared/presenter';
import { ToddComponent } from '../../../todd/todd';
import { ButtonComponent } from '../../../button';

@Component({
  selector: 'ui-cta',
  imports: [CommonModule, RouterLink, TranslatePipe, ToddComponent, ButtonComponent],
  templateUrl: './cta.component.html',
})
export class CtaComponent {
  public readonly label = input('');
  public readonly description = input('');
  public readonly cta = input('');
  public readonly ctaLink = input('');
  public readonly icon = input('folder-open');
  public readonly styleClass = input('');

  public readonly ctaClick = output<void>();
}
