/**
 * Polyfills de compatibilidad para WebViews de Android viejos.
 *
 * La app nativa (Capacitor) corre dentro del "Android System WebView" del
 * dispositivo, que en teléfonos viejos/sin actualizar puede ser Chrome 91 o
 * anterior. Angular 20 (y varias libs) usan APIs de JS/Canvas modernas que en
 * esos WebViews NO existen, y revientan con "X is not a function" — p. ej. el
 * login con Google fallaba con `Object.hasOwn is not a function` (visto en
 * producción en Sentry, WebView 91 / Android 11).
 *
 * Todos los polyfills son *feature-detected*: en un navegador/WebView moderno
 * no hacen nada. Este archivo se carga en el bundle de polyfills ANTES del
 * código de la app (ver `polyfills` en project.json), para que las APIs ya
 * estén disponibles cuando Angular arranca.
 */

// Object.hasOwn — Chrome/WebView 93+ (confirmado rompiendo el login nativo).
if (typeof (Object as { hasOwn?: unknown }).hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    value(obj: unknown, prop: PropertyKey): boolean {
      if (obj == null) throw new TypeError('Cannot convert undefined or null to object');
      return Object.prototype.hasOwnProperty.call(obj, prop);
    },
    configurable: true,
    writable: true,
  });
}

// Array.prototype.at / String.prototype.at — Chrome/WebView 92+.
function atPolyfill(this: { length: number; [i: number]: unknown }, index: number): unknown {
  const len = this.length;
  const i = Math.trunc(index) || 0;
  const idx = i < 0 ? len + i : i;
  return idx < 0 || idx >= len ? undefined : this[idx];
}
if (typeof Array.prototype.at !== 'function') {
  Object.defineProperty(Array.prototype, 'at', {
    value: atPolyfill,
    configurable: true,
    writable: true,
  });
}
if (typeof String.prototype.at !== 'function') {
  Object.defineProperty(String.prototype, 'at', {
    value: atPolyfill,
    configurable: true,
    writable: true,
  });
}

// structuredClone — Chrome/WebView 98+. Fallback sin ciclos (suficiente para
// clonar objetos planos de datos; no cubre Map/Set/Blob pero cubre el uso común).
if (typeof (globalThis as { structuredClone?: unknown }).structuredClone !== 'function') {
  (globalThis as { structuredClone: (v: unknown) => unknown }).structuredClone = (value: unknown) =>
    value == null ? value : JSON.parse(JSON.stringify(value));
}

// CanvasRenderingContext2D.roundRect — Chrome/WebView 99+ (confirmado rompiendo
// el render de imágenes/placeholder del storefront en Sentry).
if (
  typeof CanvasRenderingContext2D !== 'undefined' &&
  typeof CanvasRenderingContext2D.prototype.roundRect !== 'function'
) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(
    this: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    radii: number | DOMPointInit | (number | DOMPointInit)[] = 0
  ): void {
    // Normaliza radii a [tl, tr, br, bl] (solo soporta números; suficiente
    // para nuestro uso con un único radio).
    let r = Array.isArray(radii) ? radii : [radii];
    if (r.length === 1) r = [r[0], r[0], r[0], r[0]];
    else if (r.length === 2) r = [r[0], r[1], r[0], r[1]];
    else if (r.length === 3) r = [r[0], r[1], r[2], r[1]];
    const n = r.map((v) => (typeof v === 'number' ? v : 0));
    const [tl, tr, br, bl] = n.map((v) => Math.min(v, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + tl, y);
    this.lineTo(x + w - tr, y);
    this.arcTo(x + w, y, x + w, y + tr, tr);
    this.lineTo(x + w, y + h - br);
    this.arcTo(x + w, y + h, x + w - br, y + h, br);
    this.lineTo(x + bl, y + h);
    this.arcTo(x, y + h, x, y + h - bl, bl);
    this.lineTo(x, y + tl);
    this.arcTo(x, y, x + tl, y, tl);
    this.closePath();
  };
}
