import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MetaPixelService } from '@catalogohoy/core';
import { SUPPORTED_COUNTRIES } from '@catalogohoy/ecommerce-config';
import { BaseComponent, whiteSpacesValidator } from '@shared/presenter';
import { LocationService } from '@shared/infrastructure';
import {
  ButtonComponent,
  IconComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputTextComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
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
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
  ],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup extends BaseComponent implements OnInit, OnDestroy {
  private readonly facade = inject(AuthenticationFacade);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly locationService = inject(LocationService);
  private authSub: (() => void) | null = null;
  private googlePopup: Window | null = null;
  private popupPollId: ReturnType<typeof setInterval> | null = null;
  private slugSub?: Subscription;
  private inviteToken: string | null = null;

  readonly isInviteMode = signal(false);
  readonly step = signal<Step>(1);
  readonly method = signal<Method>(null);
  readonly isGoogleLoading = signal(false);
  readonly isCheckingEmail = signal(false);
  readonly emailExistsError = signal(false);
  readonly googleAccountExistsError = signal(false);
  readonly invitedTenantName = signal<string | null>(null);

  readonly credentialsForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, whiteSpacesValidator()]],
    password: ['', [Validators.required, Validators.minLength(6), whiteSpacesValidator()]],
  });

  readonly profileForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(4), whiteSpacesValidator()]],
    storeName: ['', [Validators.required, Validators.minLength(3)]],
    country: ['', [Validators.required]],
  });

  readonly slugPreview = signal('');
  readonly supportedCountries = SUPPORTED_COUNTRIES;

  /** Flag CDN URL — ISO2 lowercase. Used in country select templates. */
  flagUrl(code: string | null | undefined): string {
    if (!code) return '';
    return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  }

  readonly totalSteps = computed(() =>
    this.method() === 'google' || this.isInviteMode() ? 2 : 3
  );

  readonly displayStep = computed(() => {
    const s = this.step();
    if (this.isInviteMode()) return 2;
    if (this.method() === 'google') return s === 3 ? 2 : 1;
    return s;
  });

  async ngOnInit() {
    // Prime the geo detection early so the country is cached by the time
    // the user submits. Fire-and-forget — signup works even if this fails.
    this.locationService.init().catch((err) => {
      console.warn('geo init failed:', err);
    });

    this.slugSub = this.profileForm.controls.storeName.valueChanges.subscribe(
      (value) => this.slugPreview.set(slugify(value ?? ''))
    );

    const skipStore = this.route.snapshot.queryParamMap.get('skip_store') === 'true';
    this.inviteToken =
      this.route.snapshot.queryParamMap.get('invite_token') ??
      sessionStorage.getItem('pending_invite_token');

    if (skipStore && this.inviteToken) {
      this.isInviteMode.set(true);
      this.profileForm.controls.storeName.clearValidators();
      this.profileForm.controls.storeName.updateValueAndValidity();
      this.method.set('email');
      this.step.set(2);

      // Lock the email field to the invited address — the backend validates
      // the invite by matching email, so letting the user type a different
      // one guarantees either a rejection or (worse) a silent mismatch.
      const inviteResult = await this.facade.validateInviteToken(this.inviteToken);
      inviteResult.mapRight((info) => {
        this.credentialsForm.controls.email.setValue(info.email);
        this.credentialsForm.controls.email.disable();
        this.invitedTenantName.set(info.tenantName);
      });
      return;
    }

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

    // getRawValue() so we include the `email` control when it's disabled
    // in invite mode (locked to the invited address).
    const { email } = this.credentialsForm.getRawValue() as {
      email: string;
      password: string;
    };
    const exists = await this.facade.checkEmailExists(email);

    if (exists) {
      this.isCheckingEmail.set(false);
      this.emailExistsError.set(true);
      return;
    }

    if (this.isInviteMode() && this.inviteToken) {
      const { password } = this.credentialsForm.getRawValue() as { password: string };
      const name = email.split('@')[0];
      const signupResult = await this.facade.signupInvitee({
        email,
        password,
        name,
        inviteToken: this.inviteToken,
      });
      if (signupResult.isLeft()) {
        this.isCheckingEmail.set(false);
        return;
      }
      await this.facade.acceptInvite(this.inviteToken);
      sessionStorage.removeItem('pending_invite_token');
      const redirectResult = await this.facade.getLoginRedirectUrl();
      redirectResult.mapRight((url) => (window.location.href = url));
      return;
    }

    this.isCheckingEmail.set(false);
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

    const { name, storeName, country } = this.profileForm.value as {
      name: string;
      storeName: string;
      country: string;
    };

    if (this.isInviteMode() && this.inviteToken) {
      const { email, password } = this.credentialsForm.getRawValue() as {
        email: string;
        password: string;
      };
      const signupResult = await this.facade.signupInvitee({
        email,
        password,
        name,
        inviteToken: this.inviteToken,
      });
      if (signupResult.isLeft()) return;
      await this.facade.acceptInvite(this.inviteToken);
      sessionStorage.removeItem('pending_invite_token');
      const redirectResult = await this.facade.getLoginRedirectUrl();
      redirectResult.mapRight((url) => (window.location.href = url));
      return;
    }

    if (this.method() === 'google') {
      const result = await this.facade.completeGoogleSignup({ name, storeName, countryCode: country });
      result.mapRight((url) => {
        this.metaPixel.trackEvent('CompleteRegistration', { content_name: storeName });
        window.location.href = url;
      });
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
        countryCode: country,
      } as SignUpCredentials);
      result.mapRight((url) => {
        this.metaPixel.trackEvent('CompleteRegistration', { content_name: storeName });
        window.location.href = url;
      });
    }
  }
}
