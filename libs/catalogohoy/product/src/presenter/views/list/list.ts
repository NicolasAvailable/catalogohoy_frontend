import { Component } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
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
  public searchForm = new FormGroup({
    search: new FormControl('', []),
  });
}
