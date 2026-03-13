import { Component, effect, inject, signal, ViewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CheckoutService, PlanStore } from '@catalogohoy/plan';
import { TenantStore } from '@catalogohoy/tenant';
import {
  confirmPasswordValidator,
  whiteSpacesValidator,
} from '@shared/presenter';
import {
  ButtonComponent,
  CardComponent,
  ConfirmDialogComponent,
  IconComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputTextComponent,
} from '@ui';
import { ProfileFacade } from '../../application';
import { ProfileService, ProfileStore } from '../../infrastructure';

@Component({
  selector: 'lib-profile',
  imports: [
    ReactiveFormsModule,
    CardComponent,
    InputTextComponent,
    InputMessageComponent,
    InputPasswordComponent,
    ButtonComponent,
    ConfirmDialogComponent,
    IconComponent,
  ],
  templateUrl: './profile.html',
})
export class Profile {
  private readonly profileFacade = inject(ProfileFacade);
  private readonly profileStore = inject(ProfileStore);
  private readonly profileService = inject(ProfileService);
  private readonly tenantStore = inject(TenantStore);
  private readonly checkoutService = inject(CheckoutService);
  public readonly planStore = inject(PlanStore);

  public readonly isCancelling = signal(false);
  public readonly isDeleting = signal(false);

  @ViewChild('cancelDialog')
  public cancelDialog!: ConfirmDialogComponent;

  @ViewChild('deleteDialog')
  public deleteDialog!: ConfirmDialogComponent;

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

  public onCancelSubscription(): void {
    this.cancelDialog.warning();
  }

  public async onConfirmCancel(): Promise<void> {
    const tenantId = this.tenantStore.tenant().tenantId;
    if (!tenantId) return;

    this.isCancelling.set(true);
    await this.checkoutService.cancelSubscription(tenantId);
    this.isCancelling.set(false);
  }

  public onDeleteAccount(): void {
    this.deleteDialog.warning();
  }

  public async onConfirmDelete(): Promise<void> {
    this.isDeleting.set(true);
    await this.profileService.deleteAccount();
    this.isDeleting.set(false);
  }
}
