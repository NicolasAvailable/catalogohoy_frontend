import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { BaseComponent, whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  IconComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputTextComponent,
} from '@ui';
import { AuthenticationFacade } from '../../../application';
import { SignUpCredentials } from '../../../domain';

function slugify(text: string): string {
  const map: Record<string, string> = {
    á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u',
    Á: 'A', É: 'E', Í: 'I', Ó: 'O', Ú: 'U',
    ñ: 'n', Ñ: 'N',
  };
  return text
    .split('')
    .map((c) => map[c] ?? c)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

type Method = 'email' | 'google' | null;
type Step = 1 | 2 | 3;

@Component({
  selector: 'app-signup',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextComponent,
    InputPasswordComponent,
    InputMessageComponent,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup extends BaseComponent implements OnInit, OnDestroy {
  private readonly facade = inject(AuthenticationFacade);
  private readonly fb = inject(FormBuilder);
  private authSub: (() => void) | null = null;
  private googlePopup: Window | null = null;
  private popupPollId: ReturnType<typeof setInterval> | null = null;
  private slugSub?: Subscription;

  readonly step = signal<Step>(1);
  readonly method = signal<Method>(null);
  readonly isGoogleLoading = signal(false);
  readonly isCheckingEmail = signal(false);
  readonly emailExistsError = signal(false);
  readonly googleAccountExistsError = signal(false);

  readonly credentialsForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, whiteSpacesValidator()]],
    password: ['', [Validators.required, Validators.minLength(6), whiteSpacesValidator()]],
  });

  readonly profileForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(4), whiteSpacesValidator()]],
    storeName: ['', [Validators.required, Validators.minLength(3)]],
  });

  readonly slugPreview = signal('');

  readonly totalSteps = computed(() => (this.method() === 'google' ? 2 : 3));

  readonly displayStep = computed(() => {
    const s = this.step();
    if (this.method() === 'google') return s === 3 ? 2 : 1;
    return s;
  });

  async ngOnInit() {
    this.slugSub = this.profileForm.controls.storeName.valueChanges.subscribe(
      (value) => this.slugPreview.set(slugify(value ?? ''))
    );

    const pending = sessionStorage.getItem('auth_pending');
    if (pending === 'google_signup') {
      sessionStorage.removeItem('auth_pending');
      const hasSession = await this.facade.getSession();
      if (hasSession) {
        const hasStore = await this.facade.checkUserHasStore();
        if (hasStore) {
          this.googleAccountExistsError.set(true);
          await this.facade.logout();
          return;
        }
        this.method.set('google');
        this.step.set(3);
      }
    }
  }

  chooseEmail() {
    this.method.set('email');
    this.step.set(2);
  }

  async chooseGoogle() {
    this.googleAccountExistsError.set(false);
    this.isGoogleLoading.set(true);

    const url = await this.facade.loginWithGoogle('signup');
    if (!url) {
      this.isGoogleLoading.set(false);
      return;
    }

    const popup = window.open(url, 'google-oauth', 'width=500,height=600,left=400,top=200');
    this.googlePopup = popup;

    if (!popup) {
      sessionStorage.setItem('auth_pending', 'google_signup');
      window.location.href = url;
      return;
    }

    this.authSub = this.facade.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        this.clearGooglePolling();
        this.isGoogleLoading.set(false);

        const hasStore = await this.facade.checkUserHasStore();
        if (hasStore) {
          this.googleAccountExistsError.set(true);
          await this.facade.logout();
          return;
        }

        this.method.set('google');
        this.step.set(3);
      }
    });

    this.popupPollId = setInterval(() => {
      if (popup.closed) {
        if (this.isGoogleLoading()) {
          this.clearGooglePolling();
          this.isGoogleLoading.set(false);
        }
      }
    }, 500);
  }

  private clearGooglePolling() {
    this.authSub?.();
    this.authSub = null;
    this.googlePopup?.close();
    this.googlePopup = null;
    if (this.popupPollId) {
      clearInterval(this.popupPollId);
      this.popupPollId = null;
    }
  }

  ngOnDestroy() {
    this.clearGooglePolling();
    this.slugSub?.unsubscribe();
  }

  async nextStep() {
    if (!this.credentialsForm.valid) {
      this.credentialsForm.markAllAsTouched();
      return;
    }

    this.emailExistsError.set(false);
    this.isCheckingEmail.set(true);

    const email = this.credentialsForm.value.email as string;
    const exists = await this.facade.checkEmailExists(email);

    this.isCheckingEmail.set(false);

    if (exists) {
      this.emailExistsError.set(true);
      return;
    }

    this.step.set(3);
  }

  back() {
    if (this.step() === 2) {
      this.step.set(1);
      this.method.set(null);
    } else if (this.step() === 3 && this.method() === 'email') {
      this.step.set(2);
    }
  }

  async submit() {
    if (!this.profileForm.valid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    if (this.loaderStore.isEnable()) return;

    const { name, storeName } = this.profileForm.value as {
      name: string;
      storeName: string;
    };

    if (this.method() === 'google') {
      const result = await this.facade.completeGoogleSignup({ name, storeName });
      result.mapRight((url) => (window.location.href = url));
    } else {
      const { email, password } = this.credentialsForm.value as {
        email: string;
        password: string;
      };
      const result = await this.facade.signup({
        name,
        email,
        storeName,
        password,
      } as SignUpCredentials);
      result.mapRight((url) => (window.location.href = url));
    }
  }
}
