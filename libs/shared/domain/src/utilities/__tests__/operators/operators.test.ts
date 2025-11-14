import { not, and, or, boolean } from '../../operators/operators';

describe('operators', () => {
  test('boolean converts values correctly', () => {
    expect(boolean(true)).toBe(true);
    expect(boolean(false)).toBe(false);
    expect(boolean('text')).toBe(true);
    expect(boolean('')).toBe(false);
    expect(boolean(1)).toBe(true);
    expect(boolean(0)).toBe(false);
    expect(boolean(null)).toBe(false);
    expect(boolean(undefined)).toBe(false);
  });

  test('not negates the value', () => {
    expect(not(true)).toBe(false);
    expect(not(false)).toBe(true);
    expect(not(1)).toBe(false);
    expect(not(0)).toBe(true);
  });

  test('and returns true only if all values are truthy', () => {
    expect(and(true, true)).toBe(true);
    expect(and(true, false)).toBe(false);
    expect(and(1 as any, 'text' as any, [] as any)).toBe(true);
    expect(and(1 as any, 0 as any, 'text' as any)).toBe(false);
    expect(and()).toBe(false);
  });

  test('or returns true if any value is truthy', () => {
    expect(or(false, true)).toBe(true);
    expect(or(false, false)).toBe(false);
    expect(or(0 as any, '' as any, 'text' as any)).toBe(true);
    expect(or(0 as any, '' as any, null as any)).toBe(false);
    expect(or()).toBe(false);
  });
});
