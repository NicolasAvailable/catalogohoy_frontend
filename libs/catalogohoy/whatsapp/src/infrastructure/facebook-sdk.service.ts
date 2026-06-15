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
  event: 'FINISH' | 'FINISH_ONLY_WABA' | 'CANCEL' | 'ERROR';
  data: EmbeddedSignupData & {
    current_step?: string;
    error_message?: string;
  };
}

@Injectable({ providedIn: 'root' })
export class FacebookSdkService {
  private initialized = false;
  private sdkLoaded = false;

  loadSdk(): Promise<void> {
    if (this.sdkLoaded) return Promise.resolve();

    return new Promise((resolve) => {
      window.fbAsyncInit = () => {
        window.FB.init({
          appId: environment.whatsapp.facebookAppId,
          cookie: true,
          xfbml: true,
          version: environment.whatsapp.graphApiVersion,
        });
        this.initialized = true;
        resolve();
      };

      if (document.getElementById('facebook-jssdk')) {
        if (this.initialized) resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'facebook-jssdk';
      script.src = 'https://connect.facebook.net/en_US/sdk.js';
      script.defer = true;
      script.async = true;
      document.head.appendChild(script);
      this.sdkLoaded = true;
    });
  }

  launchEmbeddedSignup(): Promise<FacebookLoginResponse> {
    return new Promise((resolve, reject) => {
      if (!window.FB) {
        reject(new Error('Facebook SDK not loaded'));
        return;
      }

      window.FB.login(
        (response) => resolve(response),
        {
          config_id: environment.whatsapp.facebookConfigId,
          response_type: 'code',
          override_default_response_type: true,
          extras: {
            sessionInfoVersion: '3',
          },
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
