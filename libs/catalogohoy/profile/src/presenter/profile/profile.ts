import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AccordionComponent,
  AccordionHeaderDirective,
  AccordionPanelDirective,
  ButtonComponent,
  CardComponent,
  InputTextComponent,
} from '@ui';

@Component({
  selector: 'lib-profile',
  imports: [
    ReactiveFormsModule,
    AccordionComponent,
    AccordionHeaderDirective,
    AccordionPanelDirective,
    CardComponent,
    InputTextComponent,
    ButtonComponent,
  ],
  templateUrl: './profile.html',
})
export class Profile {
  public readonly items = signal([
    {
      ref: 'Password',
      label: 'Contraseña',
    },
  ]);
  public readonly profileForm = inject(FormBuilder).group({
    name: [''],
    email: [{ value: '', disabled: true }],
  });
  public readonly passwordForm = inject(FormBuilder).group({
    newPassword: [''],
    confirmPassword: [''],
  });
}
