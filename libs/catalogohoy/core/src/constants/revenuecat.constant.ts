/**
 * Clave PÚBLICA del SDK de RevenueCat para la app de iOS (App Store).
 * Es pública por diseño (va embebida en el cliente); la validación de recibos y
 * los entitlements los resuelve RevenueCat server-side. Se obtiene en
 * RevenueCat → Project settings → API keys → App Store app.
 *
 * Android se agregará cuando se monte Google Play Billing (key `goog_...`).
 */
export const REVENUECAT_IOS_PUBLIC_KEY = 'appl_eFbBLiNjOziYwEUSBwZejPmGxsW';

/**
 * Clave PÚBLICA del SDK de RevenueCat para la app de Android (Google Play).
 * App RevenueCat `app8cf85cd124` (package com.catalogohoy.app). Las compras se
 * validan con el service account de Google Play configurado en RevenueCat.
 */
export const REVENUECAT_ANDROID_PUBLIC_KEY = 'goog_kxWXZwxsCDhCMRDeQyVfxYAHBtg';
