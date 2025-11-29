import { Component } from '@angular/core';
import { InputPasswordComponent, InputTextComponent } from '@ui';

@Component({
  selector: 'app-login',
  imports: [InputTextComponent, InputPasswordComponent],
  templateUrl: './login.html',
})
export class Login {}
