import { isPlatformUrl } from './meta-pixel';

describe('isPlatformUrl (pixel propio solo en la plataforma)', () => {
  it.each([
    '/admin',
    '/admin/orders?order=12',
    '/pos',
    '/onboarding',
    '/bienvenida',
    '/login',
    '/signup',
    '/conectar/whatsapp?state=x',
    '/accept-invite?token=y',
  ])('plataforma: %s', (url) => {
    expect(isPlatformUrl(url)).toBe(true);
  });

  it.each([
    '/',
    '',
    '/?category=3',
    '/product/123',
    '/checkout',
    '/checkout?preview=true',
    '/v/juan',
    '/order/9/invoice',
    '/administrador', // no es /admin
    '/public/report',
  ])('catálogo del comercio (sin pixel propio): %s', (url) => {
    expect(isPlatformUrl(url)).toBe(false);
  });
});
