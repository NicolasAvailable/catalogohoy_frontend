import { Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { environment } from '@catalogohoy/env';
import { ButtonComponent } from '@ui';
import {
  EmbeddedSignupData,
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
  /** Auto-lanzar el Embedded Signup al cargar (el wizard manda &auto=1). Si el
   *  navegador bloquea el diálogo sin gesto, el botón queda como fallback. */
  private autoStart = false;

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.state = params.get('state') ?? '';
    this.missingState.set(!this.state);
    this.mode = params.get('mode') === 'dedicated' ? 'dedicated' : 'coexistence';
    this.returnUrl = params.get('return') || this.returnUrl;
    this.isPopup = params.get('popup') === '1';
    this.autoStart = params.get('auto') === '1';

    this.facebookSdk.loadSdk().then(() => {
      this.sdkReady.set(true);
      if (this.autoStart && this.state) {
        this.autoStart = false;
        this.connect();
      }
    });

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

    const response = await this.facebookSdk.launchEmbeddedSignup(this.mode);
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
