import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ButtonComponent, CardComponent, InputTextComponent } from '@ui';

@Component({
  selector: 'lib-profile',
  imports: [
    ReactiveFormsModule,
    CardComponent,
    InputTextComponent,
    ButtonComponent,
  ],
  templateUrl: './profile.html',
})
export class Profile {
  public readonly form = inject(FormBuilder).group({
    name: [''],
    email: [''],
    newPassword: [''],
    confirmPassword: [''],
  });
}
