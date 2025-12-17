import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import {
  AccordionComponent,
  AccordionHeaderDirective,
  AccordionPanelDirective,
  ButtonComponent,
  CardComponent,
  InputTextComponent,
} from '@ui';
import { ProfileStore } from '../../infrastructure';

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
  private readonly profileStore = inject(ProfileStore);

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

  constructor() {
    effect(() => {
      this.profileForm.get('name')?.setValue(this.profileStore.profile().name);
      this.profileForm
        .get('email')
        ?.setValue(this.profileStore.profile().email);
    });
  }
}
