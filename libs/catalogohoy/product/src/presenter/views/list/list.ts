import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputTextComponent,
  TableComponent,
} from '@ui';

@Component({
  selector: 'lib-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    TableComponent,
    CardComponent,
    ButtonComponent,
    InputTextComponent,
    IconComponent,
  ],
  templateUrl: './list.html',
  styleUrl: './list.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export default class List {
  public products = [
    {
      name: 'Producto',
      price: 100,
      stock: 100,
    },
    {
      name: 'Producto',
      price: 100,
      stock: 100,
    },
    {
      name: 'Producto',
      price: 100,
      stock: 100,
    },
  ];
  public searchForm = new FormGroup({
    search: new FormControl('', []),
  });
}
