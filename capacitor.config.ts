import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor envuelve la app Angular `catalogohoy` como app nativa iOS/Android.
 *
 * El shell nativo es SOLO el admin del comerciante — el storefront público
 * (multi-tenant por slug) vive en la web. El entry-point nativo (login →
 * resolver slug del perfil → /admin) se implementa en la Fase 1.
 *
 * `webDir` apunta al output del builder `@angular/build:application`
 * (`dist/apps/catalogohoy` + subcarpeta `browser/`).
 */
const config: CapacitorConfig = {
  appId: 'com.catalogohoy.app',
  appName: 'CatalogoHoy',
  webDir: 'dist/apps/catalogohoy/browser',
  ios: {
    // `never`: NO dejamos que WKWebView ajuste el contentInset por su cuenta —
    // los safe-areas del notch/home-indicator los maneja 100% el CSS
    // (viewport-fit=cover + env(safe-area-inset-*), ver styles.css + navbar).
    // Con `always` el scroll rebotaba y metía el contenido bajo la status bar.
    contentInset: 'never',
  },
  plugins: {
    SplashScreen: {
      // Lo escondemos a mano desde NativePlatformService una vez que Angular
      // ya pintó, para evitar el flash en blanco del arranque.
      launchAutoHide: false,
    },
    // Push por FCM vía @capacitor-firebase/messaging (token FCM en iOS+Android).
    // La presentación en foreground se maneja en el plugin/AppDelegate.
    Keyboard: {
      resize: 'native' as never,
    },
  },
};

// Live-reload en desarrollo: exportá CAP_SERVER_URL con la IP LAN de tu Mac
// (ej. `export CAP_SERVER_URL=http://192.168.1.50:4200`) y corré
// `npm run serve:catalogohoy` para probar sobre el dispositivo sin rebuild.
if (process.env['CAP_SERVER_URL']) {
  config.server = {
    url: process.env['CAP_SERVER_URL'],
    cleartext: true,
  };
}

export default config;
