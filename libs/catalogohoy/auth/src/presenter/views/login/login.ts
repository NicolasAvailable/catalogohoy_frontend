import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  isIosApp,
  isNativeApp,
  LanguageSelectorComponent,
  setNativeSlug,
} from '@catalogohoy/core';
import {
  findCountryByCode,
  SUPPORTED_COUNTRIES,
} from '@catalogohoy/ecommerce-config';
import { TranslocoPipe } from '@jsverse/transloco';
import { BaseComponent, whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  IconComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputTextComponent,
  SelectComponent,
} from '@ui';
import { AuthenticationFacade } from '../../../application';
import { LoginCredentials } from '../../../domain';
import { SIGNUP_CONFIRM_EMAIL } from '../../../infrastructure';
import { GOOGLE_IOS_CLIENT_ID } from '../../../infrastructure/native-oauth.constants';

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
    SelectComponent,
    LanguageSelectorComponent,
    TranslocoPipe,
  ],
  templateUrl: './login.html',
  // En la app nativa (clase `native-login`) agrandamos inputs, tipografía y
  // botón para que se sientan cómodos en pantalla táctil. En web no aplica.
  styles: [
    `
      :host ::ng-deep .native-login .p-inputtext {
        padding-block: 1rem !important;
        font-size: 1.0625rem !important;
      }
      .native-login h1 {
        font-size: 2.25rem;
        line-height: 2.5rem;
      }
      .native-login p {
        font-size: 1.05rem;
      }
      .native-login label {
        font-size: 1rem;
      }
      /* El selector de idioma (absolute top-6) quedaba DETRÁS de la barra de
         estado / notch en nativo → lo bajamos debajo del safe-area para que se
         vea y sea tocable. */
      .native-login lib-language-selector {
        top: calc(0.75rem + env(safe-area-inset-top, 0px));
      }
    `,
  ],
})
export class Login extends BaseComponent implements OnInit, OnDestroy {
  private readonly facade = inject(AuthenticationFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  /** true en la app nativa (Capacitor): login social por SDK y ruteo in-app. */
  readonly isNative = isNativeApp();
  /** Sign in with Apple solo tiene sentido (y es requisito 4.8) en iOS. */
  readonly showAppleLogin = isIosApp();
  /** En iOS el Google nativo necesita su OAuth client; sin él, no se ofrece. */
  readonly showGoogleNative =
    this.isNative && (!isIosApp() || GOOGLE_IOS_CLIENT_ID.length > 0);
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

  // ── Registro in-app (nativo): cuenta social sin catálogo todavía ─────────
  /** Provider social con login en curso ('apple' | 'google') o null. */
  readonly socialLoading = signal<'apple' | 'google' | null>(null);
  /** true → la card muestra el paso "ponle nombre a tu catálogo". */
  readonly needsStoreSetup = signal(false);
  readonly isCreatingStore = signal(false);
  /** Nombre entregado por el provider (Apple solo la 1ª autorización). */
  private socialName: string | null = null;
  readonly countries = SUPPORTED_COUNTRIES;
  public readonly storeForm = inject(FormBuilder).group({
    storeName: ['', [Validators.required, whiteSpacesValidator()]],
    name: ['', [Validators.required, whiteSpacesValidator()]],
    countryCode: [this.detectCountryCode()],
  });

  // ── Registro in-app con email/contraseña (nativo) ────────────────────────
  /** true → la card muestra el formulario de "crear cuenta". */
  readonly showSignup = signal(false);
  readonly isSigningUp = signal(false);
  /** true tras un signup que quedó pendiente de confirmar el correo. */
  readonly signupConfirmEmail = signal(false);
  public readonly signupForm = inject(FormBuilder).group({
    email: ['', [Validators.required, Validators.email, whiteSpacesValidator()]],
    password: [
      '',
      [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
    ],
    name: ['', [Validators.required, whiteSpacesValidator()]],
    storeName: ['', [Validators.required, whiteSpacesValidator()]],
    countryCode: [this.detectCountryCode()],
  });

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
        // App nativa: no navegamos a un subdominio (sacaría del shell).
        // Resolvemos el slug del tenant, lo cacheamos y ruteamos in-app a /admin.
        if (this.isNative) {
          await this.goToAdminNative();
          return;
        }
        window.location.href = this.applyReturnUrl(url);
      }
    }
  }

  /** Post-login nativo: cachea el slug del tenant y navega in-app a /admin. */
  private async goToAdminNative(): Promise<void> {
    const result = await this.facade.getMyTenantSlug();
    if (result.isRight()) {
      setNativeSlug(result.value as string);
      await this.router.navigateByUrl('/admin');
      return;
    }
    // Sin catálogo asociado (o error): el registro se hace en la web.
    this.googleError.set(
      'No tienes un catálogo registrado. Regístrate en catalogohoy.com para usar la app.'
    );
    await this.facade.logout();
  }

  /** País por defecto del alta in-app, desde el locale del teléfono
   *  (ej. "es-VE" → VE). Si no está soportado, queda sin selección. */
  private detectCountryCode(): string | null {
    const region = navigator.language?.split('-')[1]?.toUpperCase() ?? null;
    return findCountryByCode(region)?.code ?? null;
  }

  /** Login social NATIVO (Apple/Google). Si la cuenta no tiene catálogo,
   *  en vez de rebotar al usuario pasamos al alta in-app (needsStoreSetup). */
  public async loginWithSocial(provider: 'apple' | 'google'): Promise<void> {
    if (this.socialLoading()) return;
    this.socialLoading.set(provider);
    this.googleError.set(null);

    const result = await this.facade.loginWithSocialNative(provider);
    if (result.isLeft()) {
      const msg = (result.value as Error).message;
      // Cancelar la hoja nativa no es un error para el usuario.
      if (msg !== 'social_cancelled') {
        this.googleError.set('No se pudo iniciar sesión. Intenta de nuevo.');
      }
      this.socialLoading.set(null);
      return;
    }

    this.socialName = (result.value as { name: string | null }).name;
    if (this.pendingInviteToken) {
      await this.facade.acceptInvite(this.pendingInviteToken);
      sessionStorage.removeItem('pending_invite_token');
      this.pendingInviteToken = null;
    }

    const slug = await this.facade.getMyTenantSlug();
    if (slug.isRight()) {
      setNativeSlug(slug.value as string);
      await this.router.navigateByUrl('/admin');
      return; // el spinner sigue hasta que la navegación desmonta la vista
    }

    // Cuenta nueva (o sin catálogo): registro in-app.
    this.storeForm.patchValue({ name: this.socialName ?? '' });
    this.needsStoreSetup.set(true);
    this.socialLoading.set(null);
  }

  /** Crea el catálogo del usuario social recién logueado (registro in-app). */
  public async createStore(): Promise<void> {
    if (this.storeForm.invalid || this.isCreatingStore()) return;
    this.isCreatingStore.set(true);
    this.googleError.set(null);

    const value = this.storeForm.value;
    const result = await this.facade.completeGoogleSignup({
      name: value.name!.trim(),
      storeName: value.storeName!.trim(),
      countryCode: value.countryCode ?? undefined,
    });

    if (result.isLeft()) {
      this.googleError.set((result.value as Error).message);
      this.isCreatingStore.set(false);
      return;
    }

    // completeGoogleSignup devuelve la URL web de redirect — en nativo la
    // ignoramos: cacheamos el slug y ruteamos in-app.
    const slug = await this.facade.getMyTenantSlug();
    if (slug.isRight()) {
      setNativeSlug(slug.value as string);
      await this.router.navigateByUrl('/admin');
      return;
    }
    this.googleError.set('Ha ocurrido un error. Intenta de nuevo.');
    this.isCreatingStore.set(false);
  }

  /** Volver del alta in-app al login (cierra la sesión social a medias). */
  public async cancelStoreSetup(): Promise<void> {
    this.needsStoreSetup.set(false);
    await this.facade.logout();
  }

  /** Registro desde la app: en nativo se hace IN-APP (crea la cuenta en el plan
   *  gratis y entra al admin — NO empuja a pagar; la compra de planes vive en
   *  la web por la política IAP de Apple). En web, `/signup` normal. */
  public openSignup(): void {
    this.googleError.set(null);
    this.signupConfirmEmail.set(false);
    this.showSignup.set(true);
  }

  /** Vuelve del formulario de registro in-app al login. */
  public cancelSignup(): void {
    this.showSignup.set(false);
    this.signupConfirmEmail.set(false);
  }

  /** Crea la cuenta in-app (email/contraseña) en el plan gratis y entra al
   *  admin. Si Supabase exige confirmar el correo, muestra ese aviso. */
  public async createAccount(): Promise<void> {
    if (this.signupForm.invalid || this.isSigningUp()) return;
    this.isSigningUp.set(true);
    this.googleError.set(null);

    const v = this.signupForm.value;
    const result = await this.facade.signup({
      email: v.email!.trim(),
      password: v.password!,
      name: v.name!.trim(),
      storeName: v.storeName!.trim(),
      countryCode: v.countryCode ?? undefined,
    });

    if (result.isLeft()) {
      this.googleError.set((result.value as Error).message);
      this.isSigningUp.set(false);
      return;
    }

    // Confirm-email ON en Supabase → no hay sesión todavía.
    if ((result.value as string) === SIGNUP_CONFIRM_EMAIL) {
      this.signupConfirmEmail.set(true);
      this.isSigningUp.set(false);
      return;
    }

    // Aceptar invitación pendiente si la había.
    if (this.pendingInviteToken) {
      await this.facade.acceptInvite(this.pendingInviteToken);
      sessionStorage.removeItem('pending_invite_token');
      this.pendingInviteToken = null;
    }

    // Nativo: ignoramos la URL web de redirect; cacheamos el slug y vamos a /admin.
    const slug = await this.facade.getMyTenantSlug();
    if (slug.isRight()) {
      setNativeSlug(slug.value as string);
      await this.router.navigateByUrl('/admin');
      return;
    }
    this.googleError.set('Ha ocurrido un error. Intenta de nuevo.');
    this.isSigningUp.set(false);
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
