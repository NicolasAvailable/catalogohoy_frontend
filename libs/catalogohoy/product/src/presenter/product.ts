import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'lib-product',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './product.html',
  styleUrl: './product.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'flex-1 flex flex-col overflow-hidden',
  },
})
export class Product {}
