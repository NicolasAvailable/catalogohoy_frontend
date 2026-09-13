import { isDevMode, Injectable, inject } from '@angular/core';
import { LanguageService, SupabaseClientProvider } from '@catalogohoy/core';
import {
  findCountryByCode,
  SUPPORTED_CURRENCIES,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { TenantMapper } from '@catalogohoy/tenant';
import { E } from '@shared/domain';
import { LocationService } from '@shared/infrastructure';
import { AuthApiError } from '@supabase/supabase-js';
import {
  BaseAuthenticationService,
  ForgottenPasswordCredentials,
  GoogleSignupCredentials,
  LoginCredentials,
  ResetPasswordCredentials,
  SignUpCredentials,
} from '../domain';
import { errorMapper } from './authentication-error';
import { authenticationTokenService } from './authentication-token.service';

// Sentinel devuelto por `signup()` cuando Supabase exige confirmar el correo
// (no hay sesión todavía). El componente lo usa para mostrar "revisá tu correo"
// en vez de redirigir.
export const SIGNUP_CONFIRM_EMAIL = '__confirm_email__';

@Injectable({
  providedIn: 'root',
})
export class AuthenticationService implements BaseAuthenticationService {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly authenticationTokenService = authenticationTokenService;
  private readonly locationService = inject(LocationService);
  private readonly language = inject(LanguageService);
  private readonly tenantCurrency = inject(TenantCurrencyStore);

  /**
   * Setup tenant country + currency config right after signup. Fire-and-forget
   * — signup must succeed even if this fails.
   *
   *   1. If `explicitCountryCode` is provided (user picked at signup), use it
   *      and resolve the Spanish label from SUPPORTED_COUNTRIES.
   *   2. Otherwise fall back to geo-IP detection (Google OAuth path where we
   *      don't ask for country — though the signup form now always does).
   *
   * Writes:
   *   - `tenants.country` + `country_code`  (via update_tenant_country RPC)
   *   - `tenant_currency_config`            (upsert with country defaults)
   *   - `TenantCurrencyStore`               (localStorage cache seed)
   */
  private async setupTenantLocale(explicitCountryCode?: string): Promise<void> {
    try {
      let country: string | null = null;
      let countryCode: string | null = null;

      if (explicitCountryCode) {
        const found = findCountryByCode(explicitCountryCode);
        if (found) {
          country = found.label;
          countryCode = found.code;
        }
      }

      if (!countryCode) {
        // Geo-IP fallback (Google OAuth or missing explicit selection)
        if (!this.locationService.values) {
          await this.locationService.init();
        }
        const loc = this.locationService.values;
        if (loc?.country && loc?.countryCode) {
          country = loc.country;
          countryCode = loc.countryCode;
        }
      }

      if (!country || !countryCode) return;

      // 1. Persist tenant country
      await this.client.rpc('update_tenant_country', {
        p_country: country,
        p_country_code: countryCode,
      });

      // 2. Seed tenant_currency_config with country-appropriate defaults.
      //    VE: VES local + USD reference via BCV. Others: local currency only.
      const tenantId = await this.resolveMyTenantId();
      const defaults = this.buildCurrencyDefaults(countryCode);
      if (tenantId && defaults) {
        await this.client.from('tenant_currency_config').upsert(
          {
            tenant_id: tenantId,
            product_currency: defaults.productCurrency,
            display_currency: defaults.displayCurrency,
            exchange_rate_type: defaults.exchangeRateType,
            show_dual_currency: defaults.showDualCurrency,
            currency_symbol: defaults.currencySymbol,
            decimal_separator: defaults.decimalSeparator,
            thousand_separator: defaults.thousandSeparator,
          },
          { onConflict: 'tenant_id' }
        );

        // 3. Prime the localStorage cache so the next page renders instantly.
        this.tenantCurrency.setCurrency(tenantId, {
          localCode: defaults.productCurrency,
          localSymbol: defaults.currencySymbol,
          countryCode,
        });
      }
    } catch (err) {
      console.warn('setupTenantLocale failed:', err);
    }
  }

  private async resolveMyTenantId(): Promise<number | null> {
    const { data } = await this.client.rpc('get_my_tenant');
    const rows = data as { id?: number }[] | null;
    return rows?.[0]?.id ?? null;
  }

  private buildCurrencyDefaults(countryCode: string) {
    if (countryCode === 'VE') {
      return {
        productCurrency: 'VES',
        displayCurrency: 'USD',
        exchangeRateType: 'bcv_usd',
        showDualCurrency: true,
        currencySymbol: 'Bs.',
        decimalSeparator: ',',
        thousandSeparator: '.',
      };
    }
    const country = findCountryByCode(countryCode);
    if (!country) return null;
    const symbol =
      SUPPORTED_CURRENCIES.find((c) => c.code === country.defaultCurrency)
        ?.symbol ?? '$';
    return {
      productCurrency: country.defaultCurrency,
      displayCurrency: country.defaultCurrency,
      exchangeRateType: 'none',
      showDualCurrency: false,
      currencySymbol: symbol,
      decimalSeparator: country.decimalSeparator,
      thousandSeparator: country.thousandSeparator,
    };
  }

  public async login(
    credentials: LoginCredentials
  ): Promise<E.Either<Error, string>> {
    const { error } = await this.client.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    }
    const { data: tenantRows, error: tenantError } = await this.client.rpc(
      'get_my_tenant'
    );
    if (tenantError) {
      return E.left(new Error(tenantError.message));
    }
    const tenant = TenantMapper.toDomain(tenantRows[0]);
    return E.right(await this._authRedirectUrl(tenant.slug, tenant.customDomain));
  }

  /** Provider de auth de un email ('google' | 'email' | null). Lo usa el login
   *  para avisar "esta cuenta se registró con Google" cuando fallan las
   *  credenciales. Best-effort — ante cualquier error devuelve null (no
   *  bloquea el login). */
  public async getEmailProvider(email: string): Promise<string | null> {
    try {
      const { data } = await this.client.functions.invoke<{
        provider: string | null;
      }>('check-login-provider', { body: { email } });
      return data?.provider ?? null;
    } catch {
      return null;
    }
  }

  public async signup(
    credentials: SignUpCredentials
  ): Promise<E.Either<Error, string>> {
    // Pass country in user_metadata so the `handle_new_user` DB hook
    // creates the tenant with the correct country_code from the start.
    // This prevents the Discord lead notification (triggered on
    // users_tenants INSERT) from firing with the stale 'VE' default.
    const selectedCountry = credentials.countryCode
      ? findCountryByCode(credentials.countryCode)
      : null;

    const { data, error } = await this.client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      phone: '',
      options: {
        // A dónde vuelve el usuario tras hacer clic en el link de verificación.
        emailRedirectTo: `${window.location.origin}/confirm-email`,
        data: {
          name: credentials.name,
          display_name: credentials.name,
          phone: '',
          store_name: credentials.storeName,
          store_country_code: selectedCountry?.code ?? null,
          store_country: selectedCountry?.label ?? null,
          // WhatsApp del vendedor (E.164) para notificaciones del catálogo.
          // Queda en el metadata del usuario; persistirlo a la config de
          // notificaciones requiere actualizar el trigger `handle_new_user`
          // (pendiente en DB).
          store_whatsapp: credentials.whatsapp ?? null,
          // De qué red/canal vino el registro (utm) → lo muestra Slack y lo
          // cruza GA4. Ver _readAttribution().
          ...this._readAttribution(),
        },
      },
    });
    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    }
    this._fireSignupEvent('email');

    // Si la confirmación de correo está activada en Supabase, signUp NO devuelve
    // sesión: el usuario debe confirmar su email antes de entrar. El tenant ya lo
    // crea el hook `handle_new_user`, pero acá cortamos (no podemos llamar a
    // get_my_tenant sin sesión) y avisamos al componente con un sentinel para
    // que muestre la pantalla de "revisá tu correo".
    if (!data.session) {
      return E.right(SIGNUP_CONFIRM_EMAIL);
    }

    const { data: tenantRows, error: tenantError } = await this.client.rpc(
      'get_my_tenant'
    );
    if (tenantError) {
      return E.left(new Error(tenantError.message));
    }
    const tenant = TenantMapper.toDomain(tenantRows[0]);
    await this.setupTenantLocale(credentials.countryCode);
    await this._tryRegisterReferral(Number(tenant.id), credentials.referralCode);
    return E.right(await this._authRedirectUrl(tenant.slug, tenant.customDomain));
  }

  // ── Atribución de tráfico (de qué red vino el registro) ───────────
  /** Lee la atribución para adjuntarla al registro: primero la cookie
   *  `chy_attr` que setea el landing en `.catalogohoy.com` (first-touch con el
   *  utm de la URL de origen), y si no está, los `utm_*` de la URL del propio
   *  signup (links que apuntan directo a auth). Va a `user_metadata` → la edge
   *  fn `new-lead-slack` la muestra en Slack y GA4 la cruza por dominio.
   *  Best-effort: nunca rompe el signup. */
  private _readAttribution(): Record<string, string> {
    try {
      let source = '';
      let medium = '';
      let campaign = '';
      const m = document.cookie.match(/(?:^|;\s*)chy_attr=([^;]+)/);
      if (m) {
        const o = JSON.parse(decodeURIComponent(m[1]));
        source = (o.s ?? '').toString();
        medium = (o.m ?? '').toString();
        campaign = (o.c ?? '').toString();
      }
      if (!source) {
        const q = new URLSearchParams(window.location.search);
        source = q.get('utm_source') ?? '';
        medium = q.get('utm_medium') ?? '';
        campaign = q.get('utm_campaign') ?? '';
      }
      if (!source) return {};
      const clean = (v: string) => v.trim().slice(0, 60);
      const out: Record<string, string> = { signup_source: clean(source) };
      if (medium) out['signup_medium'] = clean(medium);
      if (campaign) out['signup_campaign'] = clean(campaign);
      return out;
    } catch {
      return {};
    }
  }

  /** Google no pasa por `signUp` con user_metadata → escribimos la atribución
   *  en el auth user (hay sesión tras el OAuth) ANTES de crear el tenant, para
   *  que el metadata esté cuando dispare el trigger de lead. Best-effort. */
  private async _writeAttribution(): Promise<void> {
    const attr = this._readAttribution();
    if (!Object.keys(attr).length) return;
    try {
      await this.client.auth.updateUser({ data: attr });
    } catch {
      /* noop — el signup no falla por esto */
    }
  }

  /** Dispara el evento `sign_up` de GA4 (si gtag está en la página) para medir
   *  registros por fuente vía la medición de dominios cruzados. */
  private _fireSignupEvent(method: 'email' | 'google'): void {
    try {
      (window as unknown as { gtag?: (...a: unknown[]) => void }).gtag?.(
        'event',
        'sign_up',
        { method }
      );
    } catch {
      /* noop */
    }
  }

  /** Best-effort: si el usuario llegó por un link `?ref=` (o tipeó un código
   *  a mano), registramos el referral pending. Errores se silencian — el
   *  signup nunca falla por esto. */
  private async _tryRegisterReferral(
    referredTenantId: number,
    code: string | null | undefined
  ): Promise<void> {
    if (!code || !code.trim()) return;
    try {
      const { data, error } = await this.client.rpc('register_referral', {
        p_code: code.trim(),
        p_referred_tenant_id: referredTenantId,
      });
      if (error) {
        console.warn('register_referral failed:', error.message);
      }
    } catch (err) {
      console.warn('register_referral threw:', err);
    }
  }

  public async forgottenPassword(input: ForgottenPasswordCredentials) {
    const { error } = await this.client.auth.resetPasswordForEmail(
      input.email,
      { redirectTo: `${window.location.origin}/reset-password` }
    );
    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    } else {
      return E.right(undefined);
    }
  }

  /** Confirma el correo tras el clic en el link de verificación: establece la
   *  sesión con los tokens del fragment y devuelve la URL del admin del tenant
   *  (el tenant ya lo creó el hook handle_new_user en el signup). */
  public async confirmEmail(
    accessToken: string,
    refreshToken: string
  ): Promise<E.Either<Error, string>> {
    const { error: sessionError } = await this.client.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken || '',
    });
    if (sessionError) {
      return E.left(new Error(sessionError.message));
    }
    const { data: tenantRows, error: tenantError } =
      await this.client.rpc('get_my_tenant');
    if (tenantError) {
      return E.left(new Error(tenantError.message));
    }
    const tenant = TenantMapper.toDomain(tenantRows[0]);
    return E.right(await this._authRedirectUrl(tenant.slug, tenant.customDomain));
  }

  public async resetPassword(
    input: ResetPasswordCredentials
  ): Promise<E.Either<Error, void>> {
    const { error: sessionError } = await this.client.auth.setSession({
      access_token: input.accessToken,
      refresh_token: input.refreshToken || '',
    });

    if (sessionError) {
      return E.left(errorMapper(sessionError as AuthApiError));
    }

    const { error } = await this.client.auth.updateUser({
      password: input.password,
    });

    if (error) {
      return E.left(errorMapper(error as AuthApiError));
    } else {
      return E.right(undefined);
    }
  }
  public async loginWithGoogle(path: string): Promise<string | null> {
    const { data } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/${path}`,
        skipBrowserRedirect: true,
      },
    });
    return data.url;
  }

  public onAuthStateChange(callback: (event: string) => void): () => void {
    const {
      data: { subscription },
    } = this.client.auth.onAuthStateChange((event) => callback(event));
    return () => subscription.unsubscribe();
  }

  public async getSession(): Promise<boolean> {
    const {
      data: { session },
    } = await this.client.auth.getSession();
    return !!session;
  }

  public async getLoginRedirectUrl(): Promise<E.Either<Error, string>> {
    const { data: tenantRows, error } = await this.client.rpc('get_my_tenant');
    if (error) return E.left(new Error(error.message));
    if (!tenantRows?.length) return E.left(new Error('no_tenant'));
    const tenant = TenantMapper.toDomain(tenantRows[0]);
    return E.right(await this._authRedirectUrl(tenant.slug, tenant.customDomain));
  }

  public buildTenantAdminUrl(slug: string, customDomain?: string | null): string {
    return this._buildRedirectUrl(slug, customDomain);
  }

  /** Redirect post-login: ANTES de navegar (la navegación mata requests en
   *  vuelo) espera que el idioma elegido en el login viaje al perfil
   *  (user_metadata) para que el admin —otro origen— lo sincronice al abrir. */
  private async _authRedirectUrl(
    slug: string,
    customDomain?: string | null
  ): Promise<string> {
    await this.language.flushToProfile();
    return this._buildRedirectUrl(slug, customDomain);
  }

  private _buildRedirectUrl(slug: string, customDomain?: string | null): string {
    const key = this.authenticationTokenService.AUTH_CONFIG_KEY;
    const value = encodeURIComponent(this.authenticationTokenService.authConfigValue ?? '');
    if (isDevMode()) {
      return `http://localhost:4200/admin?${key}=${value}`;
    }
    const host = customDomain ?? `${slug}.catalogohoy.com`;
    return `https://${host}/admin?${key}=${value}`;
  }

  public async completeGoogleSignup(
    credentials: GoogleSignupCredentials
  ): Promise<E.Either<Error, string>> {
    // Pass country directly into the RPC so the tenant is created with
    // the correct country_code, avoiding the Discord-lead race condition.
    const selectedCountry = credentials.countryCode
      ? findCountryByCode(credentials.countryCode)
      : null;

    // Escribimos la atribución en el auth user ANTES de crear el tenant, para
    // que el metadata esté cuando dispare el trigger de lead (Google confirma
    // el email al instante → el aviso a Slack sale enseguida).
    await this._writeAttribution();

    const { error } = await this.client.rpc('complete_google_signup', {
      p_name: credentials.name,
      p_store_name: credentials.storeName,
      p_country_code: selectedCountry?.code ?? null,
      p_country: selectedCountry?.label ?? null,
    });
    if (error) {
      const MSG: Record<string, string> = {
        user_not_found: 'Usuario no encontrado',
        tenant_already_exists: 'Ya tienes un catálogo registrado',
        slug_taken: 'El nombre de la tienda ya está en uso, elige otro',
        invalid_store_name: 'El nombre de la tienda no es válido',
      };
      const key = Object.keys(MSG).find((k) => error.message.includes(k));
      return E.left(new Error(key ? MSG[key] : error.message));
    }
    this._fireSignupEvent('google');
    await this.setupTenantLocale(credentials.countryCode);

    // Tras crear el tenant vía complete_google_signup, podemos registrar el
    // referral. getLoginRedirectUrl ya hace get_my_tenant — lo replicamos
    // aquí porque necesitamos el id del tenant, no solo el slug.
    const { data: tenantRows } = await this.client.rpc('get_my_tenant');
    if (tenantRows?.length) {
      const tenant = TenantMapper.toDomain(tenantRows[0]);
      await this._tryRegisterReferral(Number(tenant.id), credentials.referralCode);
    }

    return this.getLoginRedirectUrl();
  }

  public async checkEmailExists(email: string): Promise<boolean> {
    const { data } = await this.client.rpc('check_email_exists', {
      p_email: email,
    });
    return data === true;
  }

  public async checkUserHasStore(): Promise<boolean> {
    const { data } = await this.client.rpc('check_user_has_store');
    return data === true;
  }

  public async logout(): Promise<E.Either<Error, void>> {
    const { error } = await this.client.auth.signOut();
    if (error) {
      return E.left(new Error(error.message));
    }
    // Clear any per-tenant currency caches left in localStorage so the next
    // session (potentially different user/tenant) doesn't see stale data.
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith('tenant_currency_'))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* storage not available — nothing to clean */
    }
    return E.right(undefined);
  }

  public async validateInviteToken(
    token: string
  ): Promise<E.Either<Error, { email: string; tenantName: string; isRegistered: boolean }>> {
    const { data, error } = await this.client.functions.invoke<{
      email: string;
      tenantName: string;
      isRegistered: boolean;
    }>('accept-team-invite', {
      body: { action: 'check', token },
    });

    if (error) return E.left(new Error(error.message));
    if (!data) return E.left(new Error('Respuesta inválida del servidor'));
    return E.right(data);
  }

  public async acceptInvite(token: string): Promise<E.Either<Error, void>> {
    const { error } = await this.client.functions.invoke('accept-team-invite', {
      body: { token },
    });

    if (error) return E.left(new Error(error.message));
    return E.right(undefined);
  }

  public async signupInvitee(credentials: {
    email: string;
    password: string;
    name: string;
    inviteToken: string;
  }): Promise<E.Either<Error, void>> {
    // `is_invitee` + `invite_token` let the `handle_new_user` DB trigger skip
    // auto-creating a tenant for this user (they will be linked to the
    // inviter's tenant via `accept-team-invite`). Without this flag, the
    // trigger seeds an orphan tenant named after the email prefix, which
    // shows up in the tenant switcher and confuses the invitee.
    const { error } = await this.client.auth.signUp({
      email: credentials.email,
      password: credentials.password,
      options: {
        data: {
          name: credentials.name,
          display_name: credentials.name,
          is_invitee: true,
          invite_token: credentials.inviteToken,
        },
      },
    });

    if (error) return E.left(errorMapper(error as AuthApiError));
    return E.right(undefined);
  }
}
