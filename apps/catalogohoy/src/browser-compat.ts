/** Polyfills mínimos para navegadores que todavía reciben el storefront. */

// Object.hasOwn llegó en Chrome/WebView 93. Algunas visitas aún usan versiones
// anteriores y Angular/dependencias pueden invocarlo durante el arranque.
if (typeof (Object as { hasOwn?: unknown }).hasOwn !== 'function') {
  Object.defineProperty(Object, 'hasOwn', {
    value(object: object, property: PropertyKey): boolean {
      return Object.prototype.hasOwnProperty.call(object, property);
    },
    configurable: true,
    writable: true,
  });
}
