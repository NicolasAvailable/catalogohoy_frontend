// Lógica pura de los hitos de activación (CAT-73). Sin Angular ni stores → se
// testea directo. Pina el orden del "próximo paso", el criterio de "activado"
// (avisos WhatsApp es upsell en gratis, no meta) y el gating de Inicio.

import {
  ActivationState,
  activationDone,
  buildActivationSteps,
  firstPendingStep,
  isHomeUrl,
} from './activation-steps';

function state(overrides: Partial<ActivationState> = {}): ActivationState {
  return {
    productCount: 0,
    hasCustomize: false,
    sellerCount: 0,
    notifyNumber: null,
    isFree: true,
    ...overrides,
  };
}

describe('activation-steps (CAT-73)', () => {
  describe('firstPendingStep — orden producto → personalizar → vendedores', () => {
    it('catálogo vacío → producto', () => {
      const step = firstPendingStep(buildActivationSteps(state()));
      expect(step?.id).toBe('product');
      expect(step?.link).toBe('/admin/products');
    });

    it('con producto → personalizar', () => {
      const step = firstPendingStep(buildActivationSteps(state({ productCount: 2 })));
      expect(step?.id).toBe('customize');
    });

    it('con producto + personalización → vendedores', () => {
      const step = firstPendingStep(
        buildActivationSteps(state({ productCount: 1, hasCustomize: true }))
      );
      expect(step?.id).toBe('sellers');
      expect(step?.queryParams).toEqual({
        tab: 'payments',
        section: 'whatsapp-sellers',
      });
    });

    it('los 3 hitos reales hechos (plan gratis) → sin próximo paso', () => {
      const step = firstPendingStep(
        buildActivationSteps(
          state({ productCount: 1, hasCustomize: true, sellerCount: 1 })
        )
      );
      expect(step).toBeNull();
    });
  });

  describe('personalización — logo, banner o descripción cualquiera lo cumple', () => {
    it('sin nada → hito pendiente', () => {
      const s = buildActivationSteps(state({ productCount: 1 }));
      expect(s.find((x) => x.id === 'customize')?.done).toBe(false);
    });
    it('con hasCustomize → hecho', () => {
      const s = buildActivationSteps(state({ productCount: 1, hasCustomize: true }));
      expect(s.find((x) => x.id === 'customize')?.done).toBe(true);
    });
  });

  describe('avisos WhatsApp — upsell en gratis, meta en pago', () => {
    it('gratis: avisos queda locked y NO cuenta para activación', () => {
      const steps = buildActivationSteps(
        state({ productCount: 1, hasCustomize: true, sellerCount: 1, isFree: true })
      );
      const notify = steps.find((x) => x.id === 'notify');
      expect(notify?.locked).toBe(true);
      expect(notify?.ctaLabel).toBe('Ver planes');
      expect(notify?.link).toBe('/admin/plans');
      expect(activationDone(steps)).toBe(true);
      expect(firstPendingStep(steps)).toBeNull();
    });

    it('pago sin avisos: avisos SÍ es el próximo paso', () => {
      const steps = buildActivationSteps(
        state({
          productCount: 1,
          hasCustomize: true,
          sellerCount: 1,
          isFree: false,
          notifyNumber: null,
        })
      );
      const notify = steps.find((x) => x.id === 'notify');
      expect(notify?.locked).toBe(false);
      expect(notify?.ctaLabel).toBe('Configurar avisos');
      expect(notify?.queryParams).toEqual({ tab: 'notifications' });
      expect(firstPendingStep(steps)?.id).toBe('notify');
      expect(activationDone(steps)).toBe(false);
    });

    it('pago con avisos configurados → activado', () => {
      const steps = buildActivationSteps(
        state({
          productCount: 1,
          hasCustomize: true,
          sellerCount: 1,
          isFree: false,
          notifyNumber: '+5804220000000',
        })
      );
      expect(activationDone(steps)).toBe(true);
    });
  });

  describe('isHomeUrl — banner oculto en el Inicio', () => {
    it.each(['/admin', '/admin/', '/admin?foo=1', '/admin/?x=1'])(
      'oculto en %s',
      (url) => expect(isHomeUrl(url)).toBe(true)
    );
    it.each([
      '/admin/products',
      '/admin/catalog/edit',
      '/admin/orders',
      '/admin/plans',
    ])('visible en %s', (url) => expect(isHomeUrl(url)).toBe(false));
  });
});
