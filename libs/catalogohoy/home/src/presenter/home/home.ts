import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AccordionComponent,
  AccordionHeaderDirective,
  AccordionPanelDirective,
  ButtonComponent,
  IconComponent,
} from '@ui';

@Component({
  selector: 'app-home',
  imports: [
    RouterLink,
    AccordionComponent,
    AccordionHeaderDirective,
    AccordionPanelDirective,
    IconComponent,
    ButtonComponent,
  ],
  templateUrl: './home.html',
  styleUrls: ['./home.css'],
})
export class Home {
  public readonly items = signal([
    {
      label: 'Crear Producto',
      ref: 'product',
      icon: 'package',
    },
    {
      label: 'Crear Categoría',
      ref: 'category',
      icon: 'tag',
    },
    {
      label: 'Crear Cupon',
      ref: 'coupon',
      icon: 'ticket-percent',
    },
  ]);
}
