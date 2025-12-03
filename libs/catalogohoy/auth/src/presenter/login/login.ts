import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  ButtonComponent,
  InputPasswordComponent,
  InputTextComponent,
} from '@ui';

@Component({
  selector: 'app-login',
  imports: [
    RouterLink,
    InputTextComponent,
    InputPasswordComponent,
    ButtonComponent,
  ],
  templateUrl: './login.html',
})
export class Login {}
