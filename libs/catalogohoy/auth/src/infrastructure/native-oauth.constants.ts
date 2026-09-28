/**
 * Client IDs de Google OAuth para el login social NATIVO (app iOS/Android).
 * Son identificadores PÚBLICOS (no secretos) — viven en el bundle igual que
 * en cualquier app móvil.
 *
 * - WEB client: el MISMO que usa el provider Google de Supabase (su `aud` se
 *   acepta por defecto). Se usa como `webClientId` en Android/Web.
 * - iOS client: OAuth client tipo "iOS" (bundle com.catalogohoy.app) creado en
 *   Google Cloud → Credentials. Su ID debe estar en "Authorized Client IDs"
 *   del provider Google en el dashboard de Supabase, y su REVERSED id como
 *   URL scheme en ios/App/App/Info.plist.
 */
export const GOOGLE_WEB_CLIENT_ID =
  '164826274834-82m44mja7ksenf4idbtejcqk4l91prjq.apps.googleusercontent.com';

// OAuth client tipo iOS "CatalogoHoy iOS" (proyecto Catalogo Hoy, 2026-09-28).
// Su REVERSED id vive como URL scheme en ios/App/App/Info.plist.
export const GOOGLE_IOS_CLIENT_ID =
  '164826274834-ljgiuc6e541d6dvrjtuibou2qdaa8n7k.apps.googleusercontent.com';

/** Bundle id de la app nativa; para el plugin identifica el provider Apple. */
export const NATIVE_APP_BUNDLE_ID = 'com.catalogohoy.app';
