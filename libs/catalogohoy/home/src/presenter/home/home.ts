import { CommonModule } from '@angular/common';
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
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    IconComponent,
    ButtonComponent,
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
      icon: 'package',
      description: 'Agrega nuevos items a tu inventario',
      colorClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
    },
    {
      label: 'Crear Categoría',
      ref: 'category',
      icon: 'tag',
      description: 'Organiza tus productos por tipo',
      colorClass: 'text-purple-600',
      bgClass: 'bg-purple-50',
    },
    {
      label: 'Crear Orden',
      ref: 'order',
      icon: 'notepad-text',
      description: 'Registra tus ventas manualmente',
      colorClass: 'text-orange-600',
      bgClass: 'bg-orange-50',
    },
  ]);
}
