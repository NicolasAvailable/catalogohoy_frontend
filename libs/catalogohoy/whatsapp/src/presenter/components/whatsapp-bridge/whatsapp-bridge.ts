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
 *  no existe la sesión del comerciante (localStorage es por origen).
 *
 *  Instrumentado: captura y muestra en pantalla lo que devuelve Meta (respuesta
 *  de FB.login + cada postMessage) para diagnosticar el flujo de coexistencia,
 *  que entrega el `code` y los ids de la WABA por dos canales distintos. */
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

  /** Bitácora visible en pantalla (para que el cliente la capture) de lo que va
   *  entregando Meta. Es la clave para diagnosticar dónde se corta el alta. */
  readonly debug = signal<string[]>([]);
  /** Ids capturados de la WABA/número — si el alta automática falla, con esto se
   *  puede completar a mano. */
  readonly waInfo = signal<{ waba?: string; phone?: string } | null>(null);

  private state = '';
  private mode: WhatsAppConnectMode = 'coexistence';
  private returnUrl = 'https://catalogohoy.com';
  private pendingCode: string | null = null;
  private pendingData: EmbeddedSignupData | null = null;
  private removeMessageListener?: () => void;

  /** Abierto como popup desde el wizard: al terminar avisa por postMessage al
   *  dashboard y se cierra, en vez de redirigir. */
  private isPopup = false;

  private note(line: string): void {
    this.debug.update((lines) => [...lines, line]);
    // También a la consola por si hace falta el detalle completo en DevTools.
    console.log('[wa-bridge]', line);
  }

  ngOnInit(): void {
    const params = new URLSearchParams(window.location.search);
    this.state = params.get('state') ?? '';
    this.missingState.set(!this.state);
    this.mode = params.get('mode') === 'dedicated' ? 'dedicated' : 'coexistence';
    this.returnUrl = params.get('return') || this.returnUrl;
    this.isPopup = params.get('popup') === '1';
    this.note(`Puente iniciado (modo ${this.mode}).`);

    // SIN auto-lanzamiento: el Embedded Signup se dispara con el CLICK del
    // usuario en el botón. Abrir el popup de Facebook sin un gesto del usuario
    // (y encima desde una ventana que ya es popup) el navegador lo bloquea y el
    // SDK no vuelve a llamar → antes quedaba "cargando" para siempre.
    this.initSdk();

    this.removeMessageListener = this.facebookSdk.onEmbeddedSignupMessage(
      (event) => {
        // Registramos TODO lo que manda Meta para ver exactamente qué llega.
        this.note(`Meta → ${event.event}: ${JSON.stringify(event.data ?? {})}`);

        if (event.data?.waba_id || event.data?.phone_number_id) {
          this.waInfo.set({
            waba: event.data.waba_id,
            phone: event.data.phone_number_id,
          });
        }

        if (
          event.event === 'FINISH' ||
          event.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
        ) {
          this.pendingData = event.data;
          this.tryComplete();
        } else if (event.event === 'FINISH_ONLY_WABA') {
          this.note(
            'Meta terminó SOLO la WABA (sin número). Falta elegir/verificar el número de teléfono para poder conectar.'
          );
        } else if (event.event === 'CANCEL' || event.event === 'ERROR') {
          this.status.set('error');
          this.errorMsg.set(
            event.data?.error_message ||
              'Facebook canceló o falló el proceso. Reintentá y completá todos los pasos.'
          );
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
      () => {
        this.sdkReady.set(true);
        this.note('SDK de Facebook cargado.');
      },
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
    this.note('Abriendo el asistente de Facebook…');

    // Red de seguridad: si el diálogo de Facebook nunca responde (bloqueo raro
    // aun con el click), liberar el botón en vez de quedar "cargando" para
    // siempre. Es holgado para no cortar un alta en curso.
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

    this.note(
      `FB.login → status=${response.status}, code=${
        response.authResponse?.code ? 'sí' : 'no'
      }`
    );

    // Tomamos el `code` si vino, sin exigir status='connected' (el flujo de
    // coexistencia a veces lo entrega distinto). Si ya llegaron los ids por
    // postMessage, tryComplete() ya está guardando; si no, esperamos ese mensaje.
    const code = response.authResponse?.code;
    if (code) {
      this.pendingCode = code;
      this.tryComplete();
      if (this.status() === 'connecting') {
        this.note('Tengo el código; esperando los datos de la WABA de Meta…');
      }
      return;
    }

    // Sin code no se puede intercambiar el token → no hay alta.
    this.status.set('error');
    this.errorMsg.set(
      this.pendingData || this.waInfo()
        ? 'Facebook devolvió los datos de la cuenta pero NO el código de autorización, así que no se pudo terminar la conexión. Reintentá y completá TODO el asistente dentro de esta ventana (sin cerrarla ni terminar en el teléfono).'
        : 'Facebook cerró sin devolver el código de autorización. Reintentá y completá todos los pasos dentro de esta ventana.'
    );
  }

  /** Con code + ids de la WABA, completa el alta server-side (el `state`
   *  firmado identifica al tenant — aquí no hay sesión). */
  private async tryComplete(): Promise<void> {
    if (!this.pendingCode || !this.pendingData) return;
    const code = this.pendingCode;
    const data = this.pendingData;
    this.pendingCode = null;
    this.pendingData = null;

    this.note(
      `Enviando alta a CatalogoHoy (waba=${data.waba_id ?? '—'}, phone=${
        data.phone_number_id ?? '—'
      })…`
    );
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
      this.note('Alta guardada en CatalogoHoy. ✓');
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
      this.note(`Error al guardar: ${err instanceof Error ? err.message : err}`);
      this.errorMsg.set(err instanceof Error ? err.message : String(err));
      this.status.set('error');
    }
  }
}
