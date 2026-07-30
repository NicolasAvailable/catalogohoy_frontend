import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { environment } from '@catalogohoy/env';
import { ButtonComponent } from '@ui';
import {
  EmbeddedSignupData,
  FacebookLoginResponse,
  FacebookSdkService,
  WhatsAppConnectMode,
} from '../../../infrastructure';

/** Puente de conexión de WhatsApp en dominio FIJO (conectar.catalogohoy.com).
 *
 *  El SDK JS de Facebook exige que el host esté en su lista de "dominios
 *  permitidos" — imposible de mantener con un subdominio por cliente. El admin
 *  del comerciante pide a wa-onboard (action=start) un `state` firmado y lo
 *  manda aquí; esta página corre el Embedded Signup en el dominio permitido,
 *  completa el alta vía wa-onboard (action=complete, el state autentica) y
 *  devuelve el navegador al admin del cliente. Página pública: en este dominio
 *  no existe la sesión del comerciante (localStorage es por origen). */
@Component({
  selector: 'lib-whatsapp-bridge',
  standalone: true,
  imports: [ButtonComponent, TranslocoPipe],
  templateUrl: './whatsapp-bridge.html',
  host: { class: 'block min-h-screen' },
})
export class WhatsAppBridgeComponent implements OnInit, OnDestroy {
  private readonly facebookSdk = inject(FacebookSdkService);

  readonly sdkReady = signal(false);
  readonly status = signal<'idle' | 'connecting' | 'saving' | 'done' | 'error'>(
    'idle'
  );
  readonly errorMsg = signal<string | null>(null);
  /** true si llegaron sin el `state` firmado (URL abierta a mano o vencida). */
  readonly missingState = signal(false);

  private state = '';
  private mode: WhatsAppConnectMode = 'coexistence';
  private returnUrl = 'https://catalogohoy.com';
  private pendingCode: string | null = null;
  private pendingData: EmbeddedSignupData | null = null;
  private removeMessageListener?: () => void;

  /** Abierto como popup desde el wizard: al terminar avisa por postMessage al
   *  dashboard y se cierra, en vez de redirigir. */
  private isPopup = false;

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.state = params.get('state') ?? '';
    this.missingState.set(!this.state);
    this.mode = params.get('mode') === 'dedicated' ? 'dedicated' : 'coexistence';
    this.returnUrl = params.get('return') || this.returnUrl;
    this.isPopup = params.get('popup') === '1';

    // SIN auto-lanzamiento: el Embedded Signup se dispara con el CLICK del
    // usuario en el botón. Abrir el popup de Facebook sin un gesto del usuario
    // (y encima desde una ventana que ya es popup) el navegador lo bloquea y el
    // SDK no vuelve a llamar → antes quedaba "cargando" para siempre.
    this.initSdk();

    this.removeMessageListener = this.facebookSdk.onEmbeddedSignupMessage(
      (event) => {
        if (
          event.event === 'FINISH' ||
          event.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
        ) {
          this.pendingData = event.data;
          this.tryComplete();
        }
      }
    );
  }

  /** Carga el SDK y habilita el botón; si falla, muestra el error en pantalla y
   *  ofrece reintentar. */
  private initSdk(): void {
    this.status.set('idle');
    this.errorMsg.set(null);
    this.facebookSdk.loadSdk().then(
      () => this.sdkReady.set(true),
      (err) => {
        this.sdkReady.set(false);
        this.status.set('error');
        this.errorMsg.set(
          err instanceof Error ? err.message : 'No se pudo cargar Facebook.'
        );
      }
    );
  }

  /** Botón "Reintentar" del estado de error: recarga el SDK. */
  retry(): void {
    this.initSdk();
  }

  ngOnDestroy(): void {
    this.removeMessageListener?.();
  }

  async connect(): Promise<void> {
    if (!this.sdkReady() || !this.state) return;
    if (this.status() === 'connecting' || this.status() === 'saving') return;

    this.status.set('connecting');
    this.errorMsg.set(null);
    this.pendingCode = null;
    this.pendingData = null;

    // Red de seguridad: si el diálogo de Facebook nunca responde (bloqueo raro
    // aun con el click), liberar el botón en vez de quedar "cargando" para
    // siempre. Es holgado para no cortar un alta en curso; si el flujo termina
    // igual, tryComplete() lo retoma (se dispara por el postMessage FINISH).
    let settled = false;
    const watchdog = setTimeout(() => {
      if (!settled && this.status() === 'connecting') {
        this.status.set('idle');
        this.errorMsg.set(
          'No se abrió la ventana de Facebook. Permití las ventanas emergentes para este sitio y volvé a pulsar "Conectar con Facebook".'
        );
      }
    }, 120000);

    let response: FacebookLoginResponse;
    try {
      response = await this.facebookSdk.launchEmbeddedSignup(this.mode);
    } catch (err) {
      settled = true;
      clearTimeout(watchdog);
      this.status.set('error');
      this.errorMsg.set(
        err instanceof Error ? err.message : 'No se pudo abrir Facebook.'
      );
      return;
    }
    settled = true;
    clearTimeout(watchdog);

    if (response.status !== 'connected' || !response.authResponse?.code) {
      this.status.set('idle');
      return;
    }
    this.pendingCode = response.authResponse.code;
    this.tryComplete();
  }

  /** Con code + ids de la WABA, completa el alta server-side (el `state`
   *  firmado identifica al tenant — aquí no hay sesión). */
  private async tryComplete(): Promise<void> {
    if (!this.pendingCode || !this.pendingData) return;
    const code = this.pendingCode;
    const data = this.pendingData;
    this.pendingCode = null;
    this.pendingData = null;

    this.status.set('saving');
    try {
      const res = await fetch(
        `${environment.supabaseUrl}/functions/v1/wa-onboard`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'complete',
            state: this.state,
            wabaId: data.waba_id,
            phoneNumberId: data.phone_number_id,
            authCode: code,
          }),
        }
      );
      const json = await res.json();
      if (!res.ok || !json?.success) {
        throw new Error(
          typeof json?.error === 'string'
            ? json.error
            : 'No se pudo completar la conexión'
        );
      }
      this.status.set('done');
      // Popup: avisar al dashboard (payload constante, sin datos sensibles) y
      // cerrarse; el wizard escucha y navega al hub de canales conectados.
      if (this.isPopup && window.opener) {
        window.opener.postMessage('catalogohoy:wa-connected', '*');
        setTimeout(() => window.close(), 600);
        return;
      }
      const target: string = json.returnUrl || this.returnUrl;
      window.location.href = `${target}${target.includes('?') ? '&' : '?'}wa=connected`;
    } catch (err) {
      this.errorMsg.set(err instanceof Error ? err.message : String(err));
      this.status.set('error');
    }
  }
}
