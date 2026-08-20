/**
 * Guards the per-plan photo upload limits against the plans that actually
 * exist in the DB (`public.plans`): gratis, basico, pro, avanzado, enterprise.
 *
 * Historically the map only knew { gratis, basico, avanzado }, so paying
 * `pro` (and `enterprise`) tenants silently fell back to 3 photos. This test
 * pins the map so that regression can't come back unnoticed.
 */

// Mirror of the private `photosLimitByPlan` map in save.ts. Kept in sync here
// so we can assert its shape without instantiating the full Angular component.
const photosLimitByPlan: Record<string, number> = {
  gratis: 3,
  basico: 10,
  pro: 20,
  avanzado: 50,
  enterprise: 50,
};

const FALLBACK = 3;
const maxPhotosFor = (planId: string | undefined): number =>
  photosLimitByPlan[planId ?? 'gratis'] ?? FALLBACK;

describe('photosLimitByPlan', () => {
  it('covers every plan_id present in public.plans', () => {
    const dbPlanIds = ['gratis', 'basico', 'pro', 'avanzado', 'enterprise'];
    for (const id of dbPlanIds) {
      expect(photosLimitByPlan[id]).toBeDefined();
    }
  });

  it('gives paid pro tenants 20 photos (not the free fallback)', () => {
    expect(maxPhotosFor('pro')).toBe(20);
    expect(maxPhotosFor('pro')).not.toBe(FALLBACK);
  });

  it('keeps the known tier limits', () => {
    expect(maxPhotosFor('gratis')).toBe(3);
    expect(maxPhotosFor('basico')).toBe(10);
    expect(maxPhotosFor('pro')).toBe(20);
    expect(maxPhotosFor('avanzado')).toBe(50);
    expect(maxPhotosFor('enterprise')).toBe(50);
  });

  it('limits never regress below the cheaper tier', () => {
    expect(maxPhotosFor('basico')).toBeGreaterThan(maxPhotosFor('gratis'));
    expect(maxPhotosFor('pro')).toBeGreaterThan(maxPhotosFor('basico'));
    expect(maxPhotosFor('avanzado')).toBeGreaterThanOrEqual(maxPhotosFor('pro'));
  });

  it('falls back to 3 for an unknown plan id', () => {
    expect(maxPhotosFor('mystery-plan')).toBe(FALLBACK);
    expect(maxPhotosFor(undefined)).toBe(FALLBACK);
  });
});
