import { Component } from '@angular/core';
import { Empty } from './layouts';

@Component({
  selector: 'app-layout',
  imports: [Empty],
  template: `<app-empty />`,
})
export default class Layout {}
