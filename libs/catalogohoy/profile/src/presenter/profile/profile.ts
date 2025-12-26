import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  confirmPasswordValidator,
  whiteSpacesValidator,
} from '@shared/presenter';
import {
  AccordionComponent,
  AccordionHeaderDirective,
  AccordionPanelDirective,
  ButtonComponent,
  CardComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputTextComponent,
} from '@ui';
import { ProfileFacade } from '../../application';
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
    InputMessageComponent,
    InputPasswordComponent,
    ButtonComponent,
  ],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly profileFacade = inject(ProfileFacade);
  private readonly profileStore = inject(ProfileStore);

  public readonly profileForm = inject(FormBuilder).group({
    name: [
      '',
      [Validators.required, Validators.minLength(4), whiteSpacesValidator()],
    ],
    email: [{ value: '', disabled: true }],
  });
  public readonly passwordForm = inject(FormBuilder).group(
    {
      password: [
        '',
        [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
      ],
      passwordConfirmed: [
        '',
        [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
      ],
    },
    {
      validators: confirmPasswordValidator,
    }
  );
  public readonly items = signal([
    {
      ref: 'Password',
      label: 'Contraseña',
    },
  ]);

  constructor() {
    effect(() => {
      this.profileForm.get('name')?.setValue(this.profileStore.profile().name);
      this.profileForm
        .get('email')
        ?.setValue(this.profileStore.profile().email);
    });
  }

  public async updateName(): Promise<void> {
    const name = this.profileForm.get('name')?.value;
    if (this.profileForm.valid && name) {
      await this.profileFacade.updateName(name);
      this.profileStore.$profile();
    }
  }

  public async updatePassword(): Promise<void> {
    const password = this.passwordForm.get('password')?.value;
    if (this.passwordForm.valid && password) {
      await this.profileFacade.updatePassword(password);
      this.passwordForm.reset();
    }
  }
}
