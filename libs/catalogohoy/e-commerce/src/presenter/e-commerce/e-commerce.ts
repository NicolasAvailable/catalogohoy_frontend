import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-e-commerce',
  imports: [],
  template: `<p>e-commerce works!</p>`,
  styleUrl: './e-commerce.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ECommerce { }
