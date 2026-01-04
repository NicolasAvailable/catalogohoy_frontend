import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'lib-product',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './product.html',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export class Product {}
