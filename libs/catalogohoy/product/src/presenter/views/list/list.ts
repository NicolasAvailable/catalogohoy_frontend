import { Component, inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputTextComponent,
  TableComponent,
} from '@ui';
import { ProductStore } from '../../../infrastructure';

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
export default class List implements OnInit {
  public readonly productStore = inject(ProductStore);
  public searchForm = new FormGroup({
    search: new FormControl('', []),
  });

  ngOnInit() {
    this.productStore.productList$();
  }
}
