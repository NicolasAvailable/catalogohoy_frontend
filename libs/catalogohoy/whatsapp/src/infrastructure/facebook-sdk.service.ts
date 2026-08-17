import { Injectable } from '@angular/core';
import { environment } from '@catalogohoy/env';

declare global {
  interface Window {
    fbAsyncInit: () => void;
    FB: {
      init(params: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }): void;
      login(
        callback: (response: FacebookLoginResponse) => void,
        options: Record<string, unknown>
      ): void;
    };
  }
}

export interface FacebookLoginResponse {
  status: 'connected' | 'not_authorized' | 'unknown';
  authResponse?: {
    code: string;
    accessToken?: string;
    userID?: string;
  };
}

export interface EmbeddedSignupData {
  phone_number_id: string;
  waba_id: string;
  businessId?: string;
}

export interface EmbeddedSignupEvent {
  type: 'WA_EMBEDDED_SIGNUP';
  event:
    | 'FINISH'
    | 'FINISH_ONLY_WABA'
    | 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
    | 'CANCEL'
    | 'ERROR';
  data: EmbeddedSignupData & {
    current_step?: string;
    error_message?: string;
  };
}

/** Cómo se conecta el número del comerciante:
 *  - `coexistence`: conserva su app WhatsApp Business en el teléfono y los
 *    mensajes se espejan con el CRM (flujo con QR; requiere app 2.24.17+ y
 *    número con 7+ días de actividad).
 *  - `dedicated`: el número pasa a ser exclusivo de la Cloud API (flujo
 *    estándar de Embedded Signup). */
export type WhatsAppConnectMode = 'coexistence' | 'dedicated';

/** Literal del flujo de coexistencia (doc Meta "Onboarding WhatsApp Business
 *  app users"). ⚠️ Verificar en el primer test real: si Meta lo renombró, el
 *  popup abre el flujo estándar en vez del de coexistencia. */
const COEXISTENCE_FEATURE_TYPE = 'whatsapp_business_app_onboarding';

@Injectable({ providedIn: 'root' })
export class FacebookSdkService {
  private initialized = false;
  private loadingPromise: Promise<void> | null = null;

  /** Carga el SDK JS de Facebook. RECHAZA (en vez de colgarse) si el script no
   *  carga —bloqueador de anuncios/extensión, antivirus, red o CDN filtrada,
   *  fecha del equipo mal (falla el TLS)— o si tarda demasiado, para que la UI
   *  muestre el error y ofrezca reintentar. Reintentable: cada llamada tras un
   *  fallo reinyecta el script. */
  loadSdk(): Promise<void> {
    if (this.initialized) return Promise.resolve();
    if (this.loadingPromise) return this.loadingPromise;

    this.loadingPromise = new Promise<void>((resolve, reject) => {
      let done = false;
      const fail = (message: string) => {
        if (done) return;
        done = true;
        this.loadingPromise = null;
        document.getElementById('facebook-jssdk')?.remove();
        reject(new Error(message));
      };

      // Reintento: descartar un <script> previo que no llegó a inicializar.
      document.getElementById('facebook-jssdk')?.remove();

      window.fbAsyncInit = () => {
        try {
          window.FB.init({
            appId: environment.whatsapp.facebookAppId,
            cookie: true,
            xfbml: true,
            version: environment.whatsapp.graphApiVersion,
          });
        } catch {
          fail('No se pudo inicializar Facebook. Reintentá en unos segundos.');
          return;
        }
        if (done) return;
        done = true;
        this.initialized = true;
        resolve();
      };

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.defer = true;
      script.async = true;
      script.onerror = () =>
        fail(
          'No se pudo cargar Facebook. Suele ser un bloqueador de anuncios o extensión de privacidad, un antivirus, o la conexión. Desactivalos y reintentá.'
        );
      document.head.appendChild(script);

      // Meta lenta/filtrada o fecha del equipo incorrecta: no colgar sin feedback.
      setTimeout(() => {
        if (!this.initialized) {
          fail(
            'Facebook tardó demasiado en cargar. Revisá tu conexión y la fecha y hora del equipo, desactivá bloqueadores o extensiones, y reintentá.'
          );
        }
      }, 15000);
    });

    return this.loadingPromise;
  }

  launchEmbeddedSignup(
    mode: WhatsAppConnectMode = 'dedicated'
  ): Promise<FacebookLoginResponse> {
    return new Promise((resolve, reject) => {
      if (!window.FB) {
        reject(new Error('Facebook SDK not loaded'));
        return;
      }

      const extras: Record<string, unknown> = {
        setup: {},
        sessionInfoVersion: '3',
      };
      if (mode === 'coexistence') {
        extras['featureType'] = COEXISTENCE_FEATURE_TYPE;
      }

      window.FB.login(
        (response) => resolve(response),
        {
          config_id: environment.whatsapp.facebookConfigId,
          response_type: 'code',
          override_default_response_type: true,
          extras,
        }
      );
    });
  }

  onEmbeddedSignupMessage(
    callback: (data: EmbeddedSignupEvent) => void
  ): () => void {
    const listener = (event: MessageEvent) => {
      if (!event.origin?.endsWith('facebook.com')) return;

      try {
        const data =
          typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (data.type === 'WA_EMBEDDED_SIGNUP') {
          callback(data as EmbeddedSignupEvent);
        }
      } catch {
        // Non-JSON message from Facebook, ignore
      }
    };

    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }
}
