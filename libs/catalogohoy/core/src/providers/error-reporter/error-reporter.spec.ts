import { reportErrorToSlack } from './error-reporter';

/**
 * Cubre el filtro de ruido del canal de Slack (edge `notify-error`).
 * Foco del cambio: el ruido del app nativo (Capacitor) NO debe llegar al canal.
 */

const mockInvoke = jest.fn().mockResolvedValue({ data: null, error: null });

// Sólo se usa `isDevMode` de @angular/core; en test debe ser false para que
// `reportErrorToSlack` no corte por early-return de dev.
jest.mock('@angular/core', () => ({ isDevMode: () => false }));
jest.mock('ngx-sonner', () => ({ toast: { error: jest.fn() } }));
jest.mock('../supabase/supabase', () => ({
  SupabaseClientProvider: {
    getInstance: () => ({ functions: { invoke: mockInvoke } }),
  },
}));

describe('reportErrorToSlack — filtro de ruido del canal de Slack', () => {
  beforeEach(() => jest.clearAllMocks());

  const RUIDO_NATIVO = [
    'The WKWebView was deallocated before the message was delivered',
    'Error invoking jsReceiveMessages: Java bridge method invocation error',
    "undefined is not an object (evaluating 'window.webkit.messageHandlers')",
    'AbortError: The operation was aborted.',
  ];

  it.each(RUIDO_NATIVO)('NO reporta ruido del app nativo: %s', (msg) => {
    reportErrorToSlack('uncaught', msg);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('sigue filtrando el ruido histórico (Script error / ResizeObserver)', () => {
    reportErrorToSlack('uncaught', 'Script error.');
    reportErrorToSlack('uncaught', 'ResizeObserver loop limit exceeded');
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('SÍ reporta un error real (no-ruido) a notify-error', () => {
    reportErrorToSlack(
      'uncaught',
      'TypeError: no puedo leer x de undefined [real-1]'
    );
    expect(mockInvoke).toHaveBeenCalledTimes(1);
    expect(mockInvoke).toHaveBeenCalledWith(
      'notify-error',
      expect.objectContaining({
        body: expect.objectContaining({
          source: 'uncaught',
          message: expect.stringContaining('no puedo leer x de undefined'),
        }),
      })
    );
  });

  it('dedupe: el mismo mensaje no se reporta dos veces', () => {
    const msg = 'Error: fallo puntual [dedupe-unico]';
    reportErrorToSlack('uncaught', msg);
    reportErrorToSlack('uncaught', msg);
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });

  const ESPERADOS = [
    'El correo o la contraseña son invalidos',
    'The email or password is invalid',
    'No pudimos leer esta imagen. Verifica que sea JPG, PNG o WEBP e intenta de nuevo.',
    'Llegaste al límite de 5 imágenes de tu plan.',
    'Upgrade your plan to add more products to your catalog.',
    'No te alcanzan: compra más créditos desde tu perfil o mejora tu plan.',
    'PLAN_LIMIT_EXCEEDED:Has alcanzado el límite de 50 productos de tu plan Gratis.',
    'La exportación de productos está disponible en los planes pagos.',
    'El campo es obligatorio',
    'No tienes permiso para generar reportes',
  ];

  it.each(ESPERADOS)('NO reporta errores esperados del usuario: %s', (msg) => {
    reportErrorToSlack('toast', msg);
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it('SÍ reporta un toast de falla real', () => {
    reportErrorToSlack('toast', 'Error al guardar la plantilla [real-toast]');
    expect(mockInvoke).toHaveBeenCalledTimes(1);
  });
});
