import { TestBed } from '@angular/core/testing';
import { PosCartStore } from './pos-cart.store';

/** Cubre el descuento global del POS: porcentaje, monto fijo y sus bordes
 *  (clamp, exclusión mutua, nunca dejar el total en negativo). */
describe('PosCartStore — descuento global', () => {
  let store: InstanceType<typeof PosCartStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(PosCartStore);
    store.clear();
    // Dos líneas: subtotal = 100.
    store.addLine({ productId: 1, name: 'A', price: 60 });
    store.addLine({ productId: 2, name: 'B', price: 40 });
  });

  it('parte sin descuento', () => {
    expect(store.subtotal()).toBe(100);
    expect(store.discountAmount()).toBe(0);
    expect(store.total()).toBe(100);
    expect(store.discountMode()).toBe('percent');
  });

  it('aplica un porcentaje', () => {
    store.setDiscountPercent(15);
    expect(store.discountMode()).toBe('percent');
    expect(store.discountAmount()).toBe(15);
    expect(store.total()).toBe(85);
  });

  it('aplica un monto fijo', () => {
    store.setDiscountFixed(25);
    expect(store.discountMode()).toBe('amount');
    expect(store.discountAmount()).toBe(25);
    expect(store.total()).toBe(75);
  });

  it('el monto fijo nunca supera el subtotal (total no queda negativo)', () => {
    store.setDiscountFixed(500);
    expect(store.discountAmount()).toBe(100);
    expect(store.total()).toBe(0);
  });

  it('el porcentaje se clampa a 0–100', () => {
    store.setDiscountPercent(150);
    expect(store.discountAmount()).toBe(100);
    store.setDiscountPercent(-10);
    expect(store.discountAmount()).toBe(0);
  });

  it('cambiar de monto fijo a porcentaje limpia el monto fijo (excluyentes)', () => {
    store.setDiscountFixed(25);
    store.setDiscountPercent(10);
    expect(store.discountMode()).toBe('percent');
    expect(store.discountFixed()).toBe(0);
    expect(store.discountAmount()).toBe(10);
  });

  it('cambiar de porcentaje a monto fijo limpia el porcentaje (excluyentes)', () => {
    store.setDiscountPercent(10);
    store.setDiscountFixed(25);
    expect(store.discountMode()).toBe('amount');
    expect(store.discountPercent()).toBe(0);
    expect(store.discountAmount()).toBe(25);
  });

  it('clearDiscount quita cualquier descuento', () => {
    store.setDiscountFixed(25);
    store.clearDiscount();
    expect(store.discountMode()).toBe('percent');
    expect(store.discountAmount()).toBe(0);
    expect(store.total()).toBe(100);
  });
});

/** Variantes con tallas (color → talla): cada combinación es su propia línea,
 *  y la línea guarda variantId + size para que el RPC descuente esa talla. */
describe('PosCartStore — talla dentro de variante', () => {
  let store: InstanceType<typeof PosCartStore>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    store = TestBed.inject(PosCartStore);
    store.clear();
  });

  it('misma variante con distinta talla = líneas separadas', () => {
    store.addLine({ productId: 7, name: 'Franela', price: 10, variantId: 'negro', variantName: 'Negro', size: 'S' });
    store.addLine({ productId: 7, name: 'Franela', price: 10, variantId: 'negro', variantName: 'Negro', size: 'M' });
    store.addLine({ productId: 7, name: 'Franela', price: 10, variantId: 'negro', variantName: 'Negro', size: 'S' });
    const lines = store.lines();
    expect(lines.length).toBe(2);
    const s = lines.find((l) => l.size === 'S');
    expect(s?.quantity).toBe(2);
    expect(s?.variantId).toBe('negro');
  });
});
