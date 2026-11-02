/**
 * true en teléfonos/tablets (web responsive y apps Capacitor). Ahí no
 * enfocamos inputs solos: abre el teclado y tapa la pantalla.
 */
export const isTouchDevice = (): boolean =>
  typeof window !== 'undefined' &&
  !!window.matchMedia?.('(pointer: coarse)').matches;

/** Autofocus sólo en escritorio. */
export const allowAutofocus = (): boolean => !isTouchDevice();
