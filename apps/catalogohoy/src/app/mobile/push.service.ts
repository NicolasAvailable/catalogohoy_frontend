import { inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import { isNativeApp, SupabaseClientProvider } from '@catalogohoy/core';

/**
 * Registra el dispositivo para notificaciones push vía FCM (Firebase Cloud
 * Messaging) usando `@capacitor-firebase/messaging` — devuelve token FCM tanto
 * en Android como en iOS (a través de APNs configurado en Firebase), que es lo
 * que consume la edge fn `send-push-notification`. Guarda el token en Supabase
 * (`device_push_tokens`) y hace deep-link al tocar la notificación (`data.route`).
 *
 * Se inicializa desde el layout del ADMIN (ya autenticado). En web es no-op y,
 * gracias al import dinámico, Firebase NO entra al bundle web.
 */
@Injectable({ providedIn: 'root' })
export class PushService {
  private readonly router = inject(Router);
  private initialized = false;

  async init(): Promise<void> {
    if (!isNativeApp() || this.initialized) return;
    this.initialized = true;

    const { FirebaseMessaging } = await import(
      '@capacitor-firebase/messaging'
    );

    let status = (await FirebaseMessaging.checkPermissions()).receive;
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      status = (await FirebaseMessaging.requestPermissions()).receive;
    }
    if (status !== 'granted') {
      this.initialized = false; // permitir reintento en una próxima entrada
      return;
    }

    // Refresh de token (FCM rota tokens): re-guardar.
    await FirebaseMessaging.addListener('tokenReceived', ({ token }) => {
      void this.saveToken(token);
    });

    // Tap en una notificación → deep-link (p.ej. /admin/orders?order=ID).
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
