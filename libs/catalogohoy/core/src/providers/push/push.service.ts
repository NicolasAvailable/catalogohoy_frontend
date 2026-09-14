import { inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { isNativeApp } from '../../constants/tenant.constant';
import { SupabaseClientProvider } from '../supabase/supabase';

/**
 * Notificaciones push vía FCM (`@capacitor-firebase/messaging`) — token FCM en
 * Android y iOS (APNs configurado en Firebase), que consume la edge fn
 * `send-push-notification`. Guarda el token en `device_push_tokens` y hace
 * deep-link al tocar la notificación (`data.route`).
 *
 * Vive en core para poder inyectarse tanto desde el layout del ADMIN (auto-init)
 * como desde el checklist del Inicio (CTA "Activar notificaciones"). En web es
 * no-op y, por el import dinámico, Firebase NO entra al bundle web.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly router = inject(Router);
  private enrolled = false;
  private listenersAdded = false;

  /** Estado del permiso de notificaciones (para el checklist del Inicio). */
  public readonly permissionGranted = signal(false);

  /** Auto-init desde el layout: solo enrola si el permiso YA está concedido
   *  (no dispara el prompt en cada arranque; eso lo hace `enable()`). */
  async init(): Promise<void> {
    if (!isNativeApp()) return;
    const status = await this.currentStatus();
    this.permissionGranted.set(status === 'granted');
    if (status === 'granted') await this.enroll();
  }

  /** Refresca el estado del permiso sin pedirlo (para pintar el checklist). */
  async refreshStatus(): Promise<void> {
    if (!isNativeApp()) return;
    this.permissionGranted.set((await this.currentStatus()) === 'granted');
  }

  /** Pide permiso (si hace falta) y registra el dispositivo. Devuelve si quedó
   *  concedido. Lo llama el CTA "Activar notificaciones" del checklist. */
  async enable(): Promise<boolean> {
    if (!isNativeApp()) return false;
    let status = await this.currentStatus();
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      const { FirebaseMessaging } = await import(
        '@capacitor-firebase/messaging'
      );
      status = (await FirebaseMessaging.requestPermissions()).receive;
    }
    const granted = status === 'granted';
    this.permissionGranted.set(granted);
    if (granted) await this.enroll();
    return granted;
  }

  private async currentStatus(): Promise<string> {
    try {
      const { FirebaseMessaging } = await import(
        '@capacitor-firebase/messaging'
      );
      return (await FirebaseMessaging.checkPermissions()).receive;
    } catch {
      return 'denied';
    }
  }

  /** Registra listeners (refresh de token + deep-link) y guarda el token FCM. */
  private async enroll(): Promise<void> {
    if (this.enrolled) return;
    this.enrolled = true;
    const { FirebaseMessaging } = await import('@capacitor-firebase/messaging');

    if (!this.listenersAdded) {
      this.listenersAdded = true;
      await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
        void this.saveToken(token);
      });
      await FirebaseMessaging.addListener(
        'notificationActionPerformed',
        (event) => {
          const data = event.notification?.data as
            | Record<string, string>
            | undefined;
          const route = data?.['route'];
          if (route) void this.router.navigateByUrl(route);
        }
      );
    }

    try {
      const { token } = await FirebaseMessaging.getToken();
      if (token) await this.saveToken(token);
    } catch (err) {
      console.error('[push] getToken failed', err);
    }
  }

  private async saveToken(token: string): Promise<void> {
    try {
      const supabase = SupabaseClientProvider.getInstance();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      await supabase.from('device_push_tokens').upsert(
        {
          auth_user_id: user.id,
          token,
          platform: Capacitor.getPlatform(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'token' }
      );
    } catch (err) {
      console.error('[push] saveToken failed', err);
    }
  }
}
