import { tenantPlanOverride } from './tenant-plan-overrides';

describe('tenantPlanOverride', () => {
  it('L-Gante Store tiene 50 fotos y 20 variantes', () => {
    expect(tenantPlanOverride(3797)).toEqual({ maxPhotos: 50, maxVariants: 20 });
  });

  it('las demás tiendas no tienen excepción', () => {
    expect(tenantPlanOverride(614)).toEqual({});
    expect(tenantPlanOverride(null)).toEqual({});
  });
});
