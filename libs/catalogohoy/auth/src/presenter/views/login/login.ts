import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { Subscription } from 'rxjs';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  isIosApp,
  isNativeApp,
  LanguageSelectorComponent,
  setNativeSlug,
  SupabaseClientProvider,
} from '@catalogohoy/core';
import {
  findCountryByCode,
  SUPPORTED_COUNTRIES,
} from '@catalogohoy/ecommerce-config';
import { TranslocoPipe } from '@jsverse/transloco';
import { BaseComponent, whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  CheckboxComponent,
  IconComponent,
  InputMessageComponent,
  InputPasswordComponent,
  InputTextComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
} from '@ui';
import { AuthenticationFacade } from '../../../application';
import { LoginCredentials } from '../../../domain';
import { SIGNUP_CONFIRM_EMAIL } from '../../../infrastructure';
import { GOOGLE_IOS_CLIENT_ID } from '../../../infrastructure/native-oauth.constants';

/** slug derivado del nombre de la tienda (mismo mapeo que el signup web). */
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

/** Sub-paso del registro in-app (nativo), espejo del wizard web. */
type SignupStep = 'choose' | 'credentials' | 'profile';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    InputTextComponent,
    InputMessageComponent,
    InputPasswordComponent,
    ButtonComponent,
    CheckboxComponent,
    IconComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
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
  private readonly supabase = SupabaseClientProvider.getInstance();
  /** true en la app nativa (Capacitor): login social por SDK y ruteo in-app. */
  readonly isNative = isNativeApp();
  /** Sign in with Apple solo tiene sentido (y es requisito 4.8) en iOS. */
  readonly showAppleLogin = isIosApp();
  /** En iOS el Google nativo necesita su OAuth client; sin él, no se ofrece. */
  readonly showGoogleNative =
    this.isNative && (!isIosApp() || GOOGLE_IOS_CLIENT_ID.length > 0);

  /** Versión publicada de Términos + Privacidad (igual que el signup web).
   *  Se guarda en la fila del usuario al aceptar, para auditoría. */
  private static readonly TERMS_VERSION = '2026-03-13';

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
    // El nombre de la tienda se pide en el ONBOARDING (no acá): se crea con un
    // placeholder que el wizard detecta como "sembrado" y pide el real.
    storeName: ['Mi tienda'],
    name: ['', [Validators.required, whiteSpacesValidator()]],
    countryCode: [this.detectCountryCode(), [Validators.required]],
    referralCode: [''],
    acceptedTerms: [false, [Validators.requiredTrue]],
  });

  // ── Registro in-app (nativo), wizard espejo del web ──────────────────────
  /** true → la card muestra el flujo de "crear cuenta". */
  readonly showSignup = signal(false);
  /** Sub-paso del wizard de registro: elegir método → credenciales → perfil. */
  readonly signupStep = signal<SignupStep>('choose');
  readonly isSigningUp = signal(false);
  readonly isCheckingEmail = signal(false);
  readonly emailExistsError = signal(false);
  /** true tras un signup que quedó pendiente de confirmar el correo. */
  readonly signupConfirmEmail = signal(false);
  /** Preview `{slug}.catalogohoy.com` derivada del nombre de la tienda. */
  readonly slugPreview = signal('');

  public readonly signupCredentialsForm = inject(FormBuilder).group({
    email: ['', [Validators.required, Validators.email, whiteSpacesValidator()]],
    password: [
      '',
      [Validators.required, Validators.minLength(6), whiteSpacesValidator()],
    ],
  });
  public readonly signupProfileForm = inject(FormBuilder).group({
    name: [
      '',
      [Validators.required, Validators.minLength(4), whiteSpacesValidator()],
    ],
    // El nombre de la tienda se pide en el ONBOARDING (no acá): placeholder.
    storeName: ['Mi tienda'],
    countryCode: [this.detectCountryCode(), [Validators.required]],
    referralCode: [''],
    acceptedTerms: [false, [Validators.requiredTrue]],
  });

  private authSub: (() => void) | null = null;
  private googlePopup: Window | null = null;
  private popupPollId: ReturnType<typeof setInterval> | null = null;
  private slugSubs: Subscription[] = [];

  /** URL de la bandera (ISO2 en minúscula) para el selector de país. */
  flagUrl(code: string | null | undefined): string {
    if (!code) return '';
    return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  }

  async ngOnInit() {
    this.pendingInviteToken =
      this.route.snapshot.queryParamMap.get('invite_token') ??
      sessionStorage.getItem('pending_invite_token');

    // El preview del slug se alimenta del nombre de la tienda en ambos flujos
    // (registro email y alta social sin catálogo).
    this.slugSubs.push(
      this.signupProfileForm.controls.storeName.valueChanges.subscribe((v) =>
        this.slugPreview.set(slugify(v ?? ''))
      ),
      this.storeForm.controls.storeName.valueChanges.subscribe((v) =>
        this.slugPreview.set(slugify(v ?? ''))
      )
    );

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
    this.slugSubs.forEach((s) => s.unsubscribe());
    this.slugSubs = [];
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
   *  en vez de rebotar al usuario pasamos al alta in-app (needsStoreSetup).
   *  Se usa tanto desde el login como desde el paso "elegir método" del
   *  registro. */
  public async loginWithSocial(provider: 'apple' | 'google'): Promise<void> {
    if (this.socialLoading()) return;
    this.socialLoading.set(provider);
    this.googleError.set(null);

    // Red de seguridad: si el SDK nativo no responde (p.ej. la hoja de Apple se
    // cuelga), no dejamos el botón en "Conectando..." para siempre — se corta y
    // se muestra un error claro en vez de quedar trabado.
    let result: Awaited<ReturnType<typeof this.facade.loginWithSocialNative>>;
    try {
      result = await Promise.race([
        this.facade.loginWithSocialNative(provider),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('social_timeout')), 90_000)
        ),
      ]);
    } catch {
      this.googleError.set(
        provider === 'apple'
          ? 'No se pudo iniciar sesión con Apple. Intenta de nuevo o usa otro método.'
          : 'No se pudo iniciar sesión. Intenta de nuevo.'
      );
      this.socialLoading.set(null);
      return;
    }
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
      referralCode: (value.referralCode ?? '').trim() || null,
    });

    if (result.isLeft()) {
      this.googleError.set((result.value as Error).message);
      this.isCreatingStore.set(false);
      return;
    }

    await this._recordTermsAcceptance();

    // completeGoogleSignup devuelve la URL web de redirect — en nativo la
    // ignoramos: cacheamos el slug y ruteamos in-app. Alta NUEVA → al wizard de
    // onboarding (igual que la web); el wizard cierra yendo a /admin en nativo.
    const slug = await this.facade.getMyTenantSlug();
    if (slug.isRight()) {
      setNativeSlug(slug.value as string);
      await this.router.navigateByUrl('/onboarding');
      return;
    }
    this.googleError.set('Ha ocurrido un error. Intenta de nuevo.');
    this.isCreatingStore.set(false);
  }

  /** Volver del alta in-app social al login (cierra la sesión social a medias). */
  public async cancelStoreSetup(): Promise<void> {
    this.needsStoreSetup.set(false);
    this.showSignup.set(false);
    this.signupStep.set('choose');
    await this.facade.logout();
  }

  // ── Wizard de registro in-app (nativo): elegir método → … → perfil ───────

  /** Abre el registro: arranca en "elegir método" (email/Google/Apple). */
  public openSignup(): void {
    this.googleError.set(null);
    this.emailExistsError.set(false);
    this.signupConfirmEmail.set(false);
    this.signupStep.set('choose');
    this.showSignup.set(true);
  }

  /** Vuelve del registro al login. */
  public cancelSignup(): void {
    this.showSignup.set(false);
    this.signupStep.set('choose');
    this.signupConfirmEmail.set(false);
  }

  /** Elegir "Continuar con email" → paso de credenciales. */
  public chooseSignupEmail(): void {
    this.emailExistsError.set(false);
    this.signupStep.set('credentials');
  }

  /** "Volver" dentro del wizard de registro. */
  public signupBack(): void {
    if (this.signupStep() === 'profile') {
      this.signupStep.set('credentials');
    } else if (this.signupStep() === 'credentials') {
      this.signupStep.set('choose');
    }
  }

  /** Paso 2 → 3: valida credenciales y verifica que el email no exista. */
  public async signupNextStep(): Promise<void> {
    if (this.signupCredentialsForm.invalid) {
      this.signupCredentialsForm.markAllAsTouched();
      return;
    }
    this.emailExistsError.set(false);
    this.isCheckingEmail.set(true);

    const email = this.signupCredentialsForm.value.email!.trim();
    const exists = await this.facade.checkEmailExists(email);

    this.isCheckingEmail.set(false);
    if (exists) {
      this.emailExistsError.set(true);
      return;
    }
    this.signupStep.set('profile');
  }

  /** Crea la cuenta in-app (email/contraseña) en el plan gratis y entra al
   *  admin. Si Supabase exige confirmar el correo, muestra ese aviso. */
  public async createAccount(): Promise<void> {
    if (this.signupProfileForm.invalid || this.isSigningUp()) return;
    this.isSigningUp.set(true);
    this.googleError.set(null);

    const c = this.signupCredentialsForm.value;
    const p = this.signupProfileForm.value;
    const result = await this.facade.signup({
      email: c.email!.trim(),
      password: c.password!,
      name: p.name!.trim(),
      storeName: p.storeName!.trim(),
      countryCode: p.countryCode ?? undefined,
      referralCode: (p.referralCode ?? '').trim() || undefined,
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

    await this._recordTermsAcceptance();

    // Aceptar invitación pendiente si la había.
    if (this.pendingInviteToken) {
      await this.facade.acceptInvite(this.pendingInviteToken);
      sessionStorage.removeItem('pending_invite_token');
      this.pendingInviteToken = null;
    }

    // Nativo: ignoramos la URL web de redirect; cacheamos el slug. Alta NUEVA →
    // al wizard de onboarding (igual que la web); el wizard cierra yendo a
    // /admin en nativo (sin pasar por /bienvenida, que es la oferta de prueba).
    const slug = await this.facade.getMyTenantSlug();
    if (slug.isRight()) {
      setNativeSlug(slug.value as string);
      await this.router.navigateByUrl('/onboarding');
      return;
    }
    this.googleError.set('Ha ocurrido un error. Intenta de nuevo.');
    this.isSigningUp.set(false);
  }

  /** Best-effort: registra fecha + versión de aceptación de Términos +
   *  Privacidad en la fila del usuario (igual que el signup web). No bloquea
   *  el flujo si falla — la aceptación ya quedó probada por el checkbox. */
  private async _recordTermsAcceptance(): Promise<void> {
    try {
      await this.supabase.rpc('record_terms_acceptance', {
        p_version: Login.TERMS_VERSION,
      });
    } catch (err) {
      console.warn('record_terms_acceptance failed:', err);
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
