import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { MetaPixelService, SupabaseClientProvider } from '@catalogohoy/core';
import { SUPPORTED_COUNTRIES } from '@catalogohoy/ecommerce-config';
import { BaseComponent, whiteSpacesValidator } from '@shared/presenter';
import { LocationService } from '@shared/infrastructure';
import {
  ButtonComponent,
  CheckboxComponent,
  IconComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputPhoneComponent,
  InputTextComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
} from '@ui';
import { AuthenticationFacade } from '../../../application';
import { SignUpCredentials } from '../../../domain';
import { SIGNUP_CONFIRM_EMAIL } from '../../../infrastructure';

type Method = 'email' | 'google' | null;
type Step = 1 | 2 | 3 | 4;

@Component({
  selector: 'app-signup',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextComponent,
    InputPasswordComponent,
    InputMessageComponent,
    InputPhoneComponent,
    ButtonComponent,
    CheckboxComponent,
    IconComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
    TranslocoPipe,
  ],
  templateUrl: './signup.html',
  styleUrl: './signup.css',
})
export class Signup extends BaseComponent implements OnInit, OnDestroy {
  private readonly facade = inject(AuthenticationFacade);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly metaPixel = inject(MetaPixelService);
  private readonly locationService = inject(LocationService);
  private readonly supabase = SupabaseClientProvider.getInstance();

  /** Versión publicada de los Términos + Privacy. Si cambian las políticas y
   *  queremos forzar re-aceptación, subimos este número y filtramos en backend
   *  los usuarios cuyo `accepted_terms_version` quedó atrás. */
  private static readonly TERMS_VERSION = '2026-03-13';
  private authSub: (() => void) | null = null;
  private googlePopup: Window | null = null;
  private popupPollId: ReturnType<typeof setInterval> | null = null;
  private countrySub?: Subscription;
  private inviteToken: string | null = null;
  private resendIntervalId?: ReturnType<typeof setInterval>;

  readonly isInviteMode = signal(false);
  readonly step = signal<Step>(1);
  readonly method = signal<Method>(null);
  readonly isGoogleLoading = signal(false);
  readonly isCheckingEmail = signal(false);
  readonly emailExistsError = signal(false);
  readonly googleAccountExistsError = signal(false);
  readonly invitedTenantName = signal<string | null>(null);

  // ── Paso 4: verificación por código (OTP) ──────────────────────────────
  /** Email al que se mandó el código (se muestra en el paso 4). */
  readonly pendingEmail = signal<string | null>(null);
  readonly isVerifyingCode = signal(false);
  readonly otpError = signal(false);
  readonly isResending = signal(false);
  /** Segundos restantes para poder reenviar el código (0 = habilitado). */
  readonly resendCooldown = signal(0);

  readonly credentialsForm = this.fb.group({
    email: ['', [Validators.required, Validators.email, whiteSpacesValidator()]],
    password: ['', [Validators.required, Validators.minLength(6), whiteSpacesValidator()]],
  });

  // Datos personales del vendedor. El nombre de la tienda YA NO se pide acá:
  // se pide en el wizard de onboarding (que crea/renombra el catálogo). Al
  // registrarse se crea el tenant con un slug temporal (ver `_tempStoreName`).
  readonly profileForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(4), whiteSpacesValidator()]],
    country: ['', [Validators.required]],
    // WhatsApp personal del vendedor — obligatorio: es donde va a recibir los
    // pedidos de sus clientes. Emite E.164 desde ui-input-phone.
    whatsapp: ['', [Validators.required]],
    referralCode: [''],
    acceptedTerms: [false, [Validators.requiredTrue]],
  });

  readonly otpForm = this.fb.group({
    code: ['', [Validators.required, Validators.minLength(6)]],
  });

  readonly supportedCountries = SUPPORTED_COUNTRIES;
  /** ISO2 (minúscula) del país elegido — alimenta `defaultCountry` del
   *  ui-input-phone para que al cambiar el país cambie el código del número. */
  readonly phoneCountryIso = signal('ve');

  /** Flag CDN URL — ISO2 lowercase. Used in country select templates. */
  flagUrl(code: string | null | undefined): string {
    if (!code) return '';
    return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  }

  readonly totalSteps = computed(() => {
    if (this.isInviteMode()) return 2;
    // Google viene con el correo ya verificado → sin paso de código.
    if (this.method() === 'google') return 2;
    // Email: método → credenciales → datos → código.
    return 4;
  });

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

    // Al elegir país, movemos el código del número de WhatsApp (hasta que el
    // usuario tipee y ui-input-phone quede fijado a su país parseado).
    this.countrySub = this.profileForm.controls.country.valueChanges.subscribe(
      (iso) => this.phoneCountryIso.set((iso || 've').toLowerCase())
    );

    // Pre-llenar el campo de código de referido con la cookie `chy_ref`
    // que vino de la landing (catalogohoy.com/?ref=XXX). Si no hay cookie
    // el campo queda vacío y el usuario puede tipear a mano.
    const cookieRef = this._readReferralCookie();
    if (cookieRef) {
      this.profileForm.controls.referralCode.setValue(cookieRef);
    }

    const skipStore = this.route.snapshot.queryParamMap.get('skip_store') === 'true';
    this.inviteToken =
      this.route.snapshot.queryParamMap.get('invite_token') ??
      sessionStorage.getItem('pending_invite_token');

    if (skipStore && this.inviteToken) {
      this.isInviteMode.set(true);
      // El invitado se suma a la tienda de quien lo invitó: no crea catálogo,
      // así que no le pedimos WhatsApp de vendedor.
      this.profileForm.controls.whatsapp.clearValidators();
      this.profileForm.controls.whatsapp.updateValueAndValidity();
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

  goToLogin() {
    this.router.navigate(['/login']);
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
    this.countrySub?.unsubscribe();
    if (this.resendIntervalId) clearInterval(this.resendIntervalId);
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

    const { name, country, whatsapp, referralCode } = this.profileForm.value as {
      name: string;
      country: string;
      whatsapp?: string;
      referralCode?: string | null;
    };
    const normalizedRef = (referralCode ?? '').trim() || null;
    const normalizedWhatsapp = (whatsapp ?? '').trim() || undefined;
    // Nombre de tienda temporal: el trigger `handle_new_user` crea el tenant +
    // slug a partir de esto. El nombre real y su slug los setea el onboarding.
    const storeName = this._tempStoreName();

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
      await this._recordTermsAcceptance();
      const redirectResult = await this.facade.getLoginRedirectUrl();
      redirectResult.mapRight((url) => (window.location.href = url));
      return;
    }

    if (this.method() === 'google') {
      const result = await this.facade.completeGoogleSignup({
        name,
        storeName,
        countryCode: country,
        referralCode: normalizedRef,
      });
      result.mapRight((url) => this._finishRegistration(url));
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
        whatsapp: normalizedWhatsapp,
        referralCode: normalizedRef,
      } as SignUpCredentials);
      result.mapRight(async (url) => {
        // Confirmación de correo activa (lo normal): sin sesión todavía → vamos
        // al paso 4 a verificar el código de 6 dígitos que llegó por email.
        if (url === SIGNUP_CONFIRM_EMAIL) {
          this.pendingEmail.set(email);
          this.step.set(4);
          this._startResendCooldown();
          return;
        }
        // Confirmación desactivada: ya hay sesión → derecho al onboarding.
        await this._finishRegistration(url);
      });
    }
  }

  /** Paso 4: verifica el código OTP del correo. Al confirmar, la sesión queda
   *  lista y redirige al wizard de onboarding. */
  async verifyCode() {
    if (this.otpForm.invalid) {
      this.otpForm.markAllAsTouched();
      return;
    }
    const email = this.pendingEmail();
    if (!email || this.isVerifyingCode()) return;

    this.otpError.set(false);
    this.isVerifyingCode.set(true);

    const { country, referralCode } = this.profileForm.value as {
      country: string;
      referralCode?: string | null;
    };
    const result = await this.facade.verifySignupOtp({
      email,
      token: (this.otpForm.controls.code.value ?? '').trim(),
      countryCode: country,
      referralCode: (referralCode ?? '').trim() || null,
    });
    this.isVerifyingCode.set(false);
    result.mapLeft(() => this.otpError.set(true));
    result.mapRight((url) => this._finishRegistration(url));
  }

  /** Reenvía el correo con el código (respeta el cooldown de 60s). */
  async resendCode() {
    const email = this.pendingEmail();
    if (!email || this.resendCooldown() > 0 || this.isResending()) return;
    this.isResending.set(true);
    this.otpError.set(false);
    await this.facade.resendSignupOtp(email);
    this.isResending.set(false);
    this._startResendCooldown();
  }

  /** Cierre común del registro: pixel + limpiar cookie ref + registrar la
   *  aceptación de términos y redirigir (al onboarding). */
  private async _finishRegistration(url: string): Promise<void> {
    this.metaPixel.trackEvent('CompleteRegistration');
    this._clearReferralCookie();
    await this._recordTermsAcceptance();
    window.location.href = url;
  }

  private _startResendCooldown(seconds = 60): void {
    if (this.resendIntervalId) clearInterval(this.resendIntervalId);
    this.resendCooldown.set(seconds);
    this.resendIntervalId = setInterval(() => {
      const next = this.resendCooldown() - 1;
      this.resendCooldown.set(next);
      if (next <= 0 && this.resendIntervalId) {
        clearInterval(this.resendIntervalId);
        this.resendIntervalId = undefined;
      }
    }, 1000);
  }

  /** Nombre de tienda temporal (aleatorio para no colisionar el slug). El
   *  wizard de onboarding lo reemplaza por el nombre real + regenera el slug. */
  private _tempStoreName(): string {
    const rand = Math.random().toString(36).slice(2, 8);
    return `mi-tienda-${rand}`;
  }

  /** Best-effort: registra la fecha + versión de aceptación de Términos +
   *  Privacy en la fila del usuario. No bloqueamos el redirect si falla — la
   *  aceptación quedó probada del lado del navegador por el `Validators.
   *  requiredTrue` del checkbox; el row update es para auditoría. */
  private async _recordTermsAcceptance(): Promise<void> {
    try {
      await this.supabase.rpc('record_terms_acceptance', {
        p_version: Signup.TERMS_VERSION,
      });
    } catch (err) {
      console.warn('record_terms_acceptance failed:', err);
    }
  }

  // ── Cookie helpers ─────────────────────────────────────────────
  // La cookie `chy_ref` la setea apps/landing con domain=.catalogohoy.com.
  // Acá la leemos para pre-llenar el campo, y la borramos cuando el signup
  // completa (con el mismo domain para que efectivamente se elimine en el
  // navegador del cliente).
  private _readReferralCookie(): string | null {
    const match = document.cookie.match(/(?:^|;\s*)chy_ref=([^;]+)/);
    if (!match) return null;
    return decodeURIComponent(match[1]).trim() || null;
  }

  private _clearReferralCookie(): void {
    const domain = this._referralCookieDomain();
    const parts = ['chy_ref=', 'path=/', 'max-age=0', 'SameSite=Lax'];
    if (domain) parts.push(`domain=${domain}`);
    document.cookie = parts.join('; ');
  }

  private _referralCookieDomain(): string | null {
    const host = window.location.hostname;
    if (host === 'catalogohoy.com' || host.endsWith('.catalogohoy.com')) {
      return '.catalogohoy.com';
    }
    if (host === 'catalogohoy.localhost' || host.endsWith('.catalogohoy.localhost')) {
      return '.catalogohoy.localhost';
    }
    return null;
  }
}


