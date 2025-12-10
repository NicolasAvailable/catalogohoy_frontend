import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  confirmPasswordValidator,
  whiteSpacesValidator,
} from '@shared/presenter';
import { ButtonComponent, InputPasswordComponent } from '@ui';
import { AuthenticationFacade } from '../../../application';
import { ResetPasswordCredentials } from '../../../domain';

@Component({
  selector: 'app-reset-password',
  imports: [ReactiveFormsModule, InputPasswordComponent, ButtonComponent],
  templateUrl: './reset-password.html',
})
export class ResetPassword implements OnInit {
  private readonly authenticationFacade = inject(AuthenticationFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  public readonly form = inject(FormBuilder).group(
    {
      password: [
        '',
        [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
      ],
      confirmPassword: ['', [Validators.required, whiteSpacesValidator()]],
    },
    {
      validators: confirmPasswordValidator,
    }
  );

  private accessToken: string | null = null;
  private refreshToken: string | null = null;

  ngOnInit() {
    this.route.fragment.subscribe((fragment) => {
      if (!fragment && !this.accessToken && !this.refreshToken) {
        this.router.navigate(['/login']);
      }
      const params = new URLSearchParams(fragment as string);
      this.accessToken = params.get('access_token');
      this.refreshToken = params.get('refresh_token');
    });
  }

  public resetPassword() {
    if (this.form.valid && this.accessToken) {
      const { password } = this.form.value;
      this.authenticationFacade.resetPassword({
        password: password,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
      } as ResetPasswordCredentials);
    }
  }

  public get passwordsMatch(): boolean {
    const password = this.form.get('password')?.value;
    const confirmPassword = this.form.get('confirmPassword')?.value;
    return password === confirmPassword;
  }
}
