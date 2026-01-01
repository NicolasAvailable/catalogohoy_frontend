import { Component } from '@angular/core';
import { ButtonComponent, CardComponent, IconComponent } from '@ui';

@Component({
  selector: 'lib-list',
  imports: [CardComponent, ButtonComponent, IconComponent],
  templateUrl: './list.html',
  styleUrl: './list.css',
  host: {
    class: 'flex-1 flex flex-col overflow-hidden',
  },
})
export default class List {}
