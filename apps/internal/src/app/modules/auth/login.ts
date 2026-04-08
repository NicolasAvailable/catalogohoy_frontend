import { Component, computed, inject, signal } from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import {
  IconComponent,
  InputPasswordComponent,
  InputTextComponent,
} from '@ui';
import { AuthStore } from './auth.store';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    InputTextComponent,
    InputPasswordComponent,
    IconComponent,
  ],
  template: `
    <div
      class="flex items-center justify-center h-screen w-screen px-4 bg-grey-25"
    >
      <div
        class="w-full max-w-md flex flex-col gap-6 p-8 bg-white rounded-2xl border border-grey-50 shadow-lg"
      >
        <div class="flex flex-col items-center gap-4">
          <ui-icon
            name="https://yvkurjivijnhliofmfmj.supabase.co/storage/v1/object/public/catalogohoy/logo.svg"
            styleClass="h-12"
          />
          <div class="flex flex-col items-center gap-1 text-center">
            <h1 class="text-2xl font-bold text-grey-700">Panel interno</h1>
            <p class="text-sm text-grey-400">
              Acceso restringido al equipo de CatalogoHoy
            </p>
          </div>
        </div>

        @if (errorMessage()) {
          <div
            class="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-50 border border-red-100"
          >
            <ui-icon
              name="circle-alert"
              size="16"
              styleClass="text-red-500 shrink-0 mt-0.5"
            />
            <span class="text-sm text-red-600">{{ errorMessage() }}</span>
          </div>
        }

        <form
          [formGroup]="form"
          (ngSubmit)="submit()"
          class="flex flex-col gap-4"
        >
          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-grey-500 uppercase tracking-wide">
              Correo
            </span>
            <ui-input-text
              size="large"
              formControlName="email"
              placeholder="tu@correo.com"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-grey-500 uppercase tracking-wide">
              Contraseña
            </span>
            <ui-input-password
              size="large"
              [feedback]="false"
              formControlName="password"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            [disabled]="form.invalid || authStore.isLoading()"
            class="mt-2 inline-flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg bg-primary-500 text-white text-base font-semibold hover:bg-primary-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            @if (authStore.isLoading()) {
              <ui-icon
                name="loader-circle"
                size="18"
                styleClass="text-white animate-spin"
              />
              Ingresando...
            } @else {
              <ui-icon name="log-in" size="18" styleClass="text-white" />
              Iniciar sesión
            }
          </button>
        </form>

        <p class="text-xs text-grey-400 text-center">
          ¿Problemas de acceso? Contactá al administrador del sistema.
        </p>
      </div>
    </div>
  `,
})
export default class Login {
  protected readonly authStore = inject(AuthStore);
  private readonly router = inject(Router);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly localError = signal<string | null>(null);

  protected readonly errorMessage = computed(
    () => this.localError() ?? this.authStore.error()
  );

  protected async submit(): Promise<void> {
    this.localError.set(null);
    this.authStore.clearError();

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.localError.set('Completá email y contraseña.');
      return;
    }

    const { email, password } = this.form.getRawValue();
    const ok = await this.authStore.login(email, password);

    if (ok) {
      this.router.navigateByUrl('/');
    }
  }
}
