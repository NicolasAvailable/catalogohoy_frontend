import { commissionBase, monthRangeIso, sellerLimitForPlan, sellerLink, shiftMonth, slugify } from './seller.model';

describe('seller.model', () => {
  it('slugify arma un link válido desde el nombre', () => {
    expect(slugify('Juan Pérez')).toBe('juan-perez');
    expect(slugify('  María José Ñuñez!! ')).toBe('maria-jose-nunez');
    expect(slugify('---')).toBe('');
  });

  it('sellerLink agrega /v/<slug> respetando dominio y ?slug=', () => {
    expect(sellerLink('https://tienda.catalogohoy.com', 'juan')).toBe('https://tienda.catalogohoy.com/v/juan');
    expect(sellerLink('https://midominio.com/', 'ana')).toBe('https://midominio.com/v/ana');
    expect(sellerLink('http://localhost:4200/?slug=demo', 'ana')).toBe('http://localhost:4200/v/ana?slug=demo');
  });

  it('límites por plan', () => {
    expect(sellerLimitForPlan('gratis')).toBe(0);
    expect(sellerLimitForPlan('basico')).toBe(0);
    expect(sellerLimitForPlan('pro')).toBe(3);
    expect(sellerLimitForPlan('avanzado')).toBe(10);
    expect(sellerLimitForPlan('enterprise')).toBe(Infinity);
  });

  it('la base de la comisión excluye el envío', () => {
    expect(commissionBase(110, 10, 0)).toBe(100);
    expect(commissionBase(95, 0, 5)).toBe(100);
    expect(commissionBase(5, 10, 0)).toBe(0);
  });

  it('meses', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    const r = monthRangeIso('2026-11');
    expect(new Date(r.from).getMonth()).toBe(10);
    expect(new Date(r.to).getMonth()).toBe(11);
  });
});
