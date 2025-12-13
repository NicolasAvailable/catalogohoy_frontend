import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Navbar, Sidebar } from '../../components';

@Component({
  selector: 'app-base',
  imports: [RouterOutlet, Navbar, Sidebar],
  templateUrl: './base.html',
})
export class Base {}
