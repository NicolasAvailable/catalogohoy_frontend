import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LanguageSelectorComponent } from '@catalogohoy/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { BaseComponent, whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  IconComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputTextComponent,
} from '@ui';
import { AuthenticationFacade } from '../../../application';
import { LoginCredentials } from '../../../domain';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextComponent,
    InputMessageComponent,
    InputPasswordComponent,
    ButtonComponent,
    IconComponent,
    LanguageSelectorComponent,
    TranslocoPipe,
  ],
  templateUrl: './login.html',
})
export class Login extends BaseComponent implements OnInit, OnDestroy {
  private readonly facade = inject(AuthenticationFacade);
  private readonly route = inject(ActivatedRoute);
  private pendingInviteToken: string | null = null;
  public readonly form = inject(FormBuilder).group({
    email: [
      '',
      [Validators.required, Validators.email, whiteSpacesValidator()],
    ],
    password: [
      '',
      [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
    ],
  });

  readonly isGoogleLoading = signal(false);
  readonly googleError = signal<string | null>(null);

  private authSub: (() => void) | null = null;
  private googlePopup: Window | null = null;
  private popupPollId: ReturnType<typeof setInterval> | null = null;

  async ngOnInit() {
    this.pendingInviteToken =
      this.route.snapshot.queryParamMap.get('invite_token') ??
      sessionStorage.getItem('pending_invite_token');

    // returnUrl (lo manda el authenticationGuard del admin): deep link al que
    // volver tras el login. Persistido en sessionStorage porque el flujo de
    // Google sin popup navega fuera y vuelve a /login sin query params.
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
    if (returnUrl) sessionStorage.setItem('pending_return_url', returnUrl);

    const pending = sessionStorage.getItem('auth_pending');
    if (pending !== 'google_login') return;

    sessionStorage.removeItem('auth_pending');
    this.isGoogleLoading.set(true);

    const hasSession = await this.facade.getSession();
    if (!hasSession) {
      this.isGoogleLoading.set(false);
      return;
    }

    await this.handlePostGoogleAuth();
  }

  ngOnDestroy() {
    this.clearGooglePolling();
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

  public async send() {
    if (this.form.valid && this.loaderStore.isDisable()) {
      const result = await this.facade.login(
        this.form.value as LoginCredentials
      );
      if (result.isRight()) {
        const url = result.value as string;
        if (this.pendingInviteToken) {
          await this.facade.acceptInvite(this.pendingInviteToken);
          sessionStorage.removeItem('pending_invite_token');
        }
        window.location.href = this.applyReturnUrl(url);
      }
    }
  }

  public async loginWithGoogle() {
    this.isGoogleLoading.set(true);
    this.googleError.set(null);

    const url = await this.facade.loginWithGoogle('login');
    if (!url) {
      this.isGoogleLoading.set(false);
      return;
    }

    const popup = window.open(url, 'google-oauth', 'width=500,height=600,left=400,top=200');
    this.googlePopup = popup;

    if (!popup) {
      sessionStorage.setItem('auth_pending', 'google_login');
      window.location.href = url;
      return;
    }

    this.authSub = this.facade.onAuthStateChange(async (event) => {
      if (event === 'SIGNED_IN') {
        this.clearGooglePolling();
        await this.handlePostGoogleAuth();
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

  /** Si hay un returnUrl pendiente (deep link del guard, p.ej. el botón
   *  "Ver pedido" de WhatsApp → /admin/orders?order=ID), redirige ahí en vez
   *  de al /admin pelado. Solo si apunta al MISMO origin que el redirect del
   *  tenant logueado (corta open redirects y tenants ajenos), y conservando
   *  los query params del login (traspaso de sesión entre subdominios). */
  private applyReturnUrl(loginUrl: string): string {
    const raw = sessionStorage.getItem('pending_return_url');
    if (!raw) return loginUrl;
    sessionStorage.removeItem('pending_return_url');
    try {
      const login = new URL(loginUrl);
      const target = new URL(raw);
      if (target.origin !== login.origin) return loginUrl;
      login.searchParams.forEach((value, key) => {
        target.searchParams.set(key, value);
      });
      return target.toString();
    } catch {
      return loginUrl;
    }
  }

  private async handlePostGoogleAuth() {
    if (this.pendingInviteToken) {
      await this.facade.acceptInvite(this.pendingInviteToken);
      sessionStorage.removeItem('pending_invite_token');
    }
    const result = await this.facade.getLoginRedirectUrl();
    if (result.isRight()) {
      window.location.href = this.applyReturnUrl(result.value as string);
      return;
    }

    const err = result.value as Error;
    this.googleError.set(
      err.message === 'no_tenant'
        ? 'No tienes un catálogo registrado. Para usar CatalogoHoy necesitas registrarte primero.'
        : 'Ha ocurrido un error. Intenta de nuevo.'
    );
    await this.facade.logout();
    this.isGoogleLoading.set(false);
  }
}
