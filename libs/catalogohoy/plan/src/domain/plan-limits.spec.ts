import { photoLimitOf, withTenantLimits } from './plan-limits';
import { Plan } from './plan.model';

const basico: Plan = {
  id: 'basico',
  name: 'Básico',
  description: '',
  price: 11.99,
  maxProducts: 100,
  maxCatalogs: 1,
  maxTeamMembers: 1,
  maxVariants: 3,
  maxAddons: 5,
  maxPhotos: 10,
  isFree: false,
  position: 1,
};

describe('plan limits', () => {
  it('usa los límites de la tienda (a medida) sobre los del plan', () => {
    const plan = withTenantLimits(basico, {
      max_products: 100,
      max_photos: 50,
      max_variants: 20,
      max_addons: 5,
      is_custom: true,
    });
    expect(plan.maxPhotos).toBe(50);
    expect(plan.maxVariants).toBe(20);
    expect(plan.hasCustomLimits).toBe(true);
    expect(plan.id).toBe('basico');
  });

  it('sin fila de límites quedan los del plan', () => {
    expect(withTenantLimits(basico, null)).toBe(basico);
  });

  it('fotos: usa max_photos y si falta, el valor por defecto del plan', () => {
    expect(photoLimitOf(basico)).toBe(10);
    expect(photoLimitOf({ id: 'pro', maxPhotos: undefined })).toBe(20);
    expect(photoLimitOf({ id: 'enterprise', maxPhotos: undefined })).toBe(0);
    expect(photoLimitOf(null)).toBe(3);
  });
});
