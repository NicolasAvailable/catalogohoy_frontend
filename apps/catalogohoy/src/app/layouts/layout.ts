import { Component } from '@angular/core';
import { Base } from './layouts';

@Component({
  selector: 'app-layout',
  imports: [Base],
  template: `<app-base />`,
  styleUrl: './layout.css',
})
export default class Layout {}
