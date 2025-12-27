import { Component, signal } from '@angular/core';
import {
  AccordionComponent,
  AccordionHeaderDirective,
  AccordionPanelDirective,
} from '@ui';

@Component({
  selector: 'app-home',
  imports: [
    AccordionComponent,
    AccordionHeaderDirective,
    AccordionPanelDirective,
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home {
  public readonly items = signal([
    {
      label: 'Crear Producto',
      ref: 'product',
    },
    {
      label: 'Crear Categoría',
      ref: 'category',
    },
    {
      label: 'Crear Cupon',
      ref: 'coupon',
    },
  ]);
}
