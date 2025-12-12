import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  BaseComponent,
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
export class ResetPassword extends BaseComponent implements OnInit {
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
      const params = new URLSearchParams(fragment as string);
      const error = params.get('error');
      if (error) {
        this.router.navigate(['/login']);
      }
      if (!this.accessToken) {
        this.accessToken = params.get('access_token');
        this.refreshToken = params.get('refresh_token');
      }
      if (!this.accessToken) {
        this.router.navigate(['/login']);
      }
    });
  }

  public async send() {
    if (this.form.valid && this.accessToken) {
      const { password } = this.form.value;
      const result = await this.authenticationFacade.resetPassword({
        password: password,
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
      } as ResetPasswordCredentials);
      result.mapRight(() => this.router.navigate(['/login']));
    }
  }
}
