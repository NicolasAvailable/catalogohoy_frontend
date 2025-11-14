import { that } from '../../that/that';

describe('that utility', () => {
  describe('or method', () => {
    it('should return the original value when it is truthy', () => {
      expect(that('hello').or('fallback')).toBe('hello');
      expect(that(42).or(0)).toBe(42);
      expect(that(true).or(false)).toBe(true);
      expect(that([1, 2, 3]).or([4, 5, 6])).toEqual([1, 2, 3]);
      expect(that({ key: 'value' }).or({ key: 'fallback' })).toEqual({ key: 'value' });
    });

    it('should return the original value when it is falsy but not null or undefined', () => {
      expect(that('').or('fallback')).toBe('');
      expect(that(0).or(42)).toBe(0);
      expect(that(false).or(true)).toBe(false);
      expect(that([] as number[]).or([1, 2, 3])).toEqual([]);
    });

    it('should return the fallback when the original value is null', () => {
      expect(that(null as string | null).or('fallback')).toBe('fallback');
      expect(that(null as number | null).or(42)).toBe(42);
      expect(that(null as boolean | null).or(true)).toBe(true);
      expect(that(null as number[] | null).or([1, 2, 3])).toEqual([1, 2, 3]);
      expect(that(null as object | null).or({ key: 'value' })).toEqual({ key: 'value' });
    });

    it('should return the fallback when the original value is undefined', () => {
      expect(that(undefined as string | undefined).or('fallback')).toBe('fallback');
      expect(that(undefined as number | undefined).or(42)).toBe(42);
      expect(that(undefined as boolean | undefined).or(true)).toBe(true);
      expect(that(undefined as number[] | undefined).or([1, 2, 3])).toEqual([1, 2, 3]);
      expect(that(undefined as object | undefined).or({ key: 'value' })).toEqual({ key: 'value' });
    });

    it('should work with complex objects', () => {
      const originalObject = { name: 'John', age: 30 };
      const fallbackObject = { name: 'Jane', age: 25 };
      
      expect(that(originalObject).or(fallbackObject)).toBe(originalObject);
      expect(that(null as typeof originalObject | null).or(fallbackObject)).toBe(fallbackObject);
      expect(that(undefined as typeof originalObject | undefined).or(fallbackObject)).toBe(fallbackObject);
    });

    it('should work with arrays', () => {
      const originalArray = [1, 2, 3];
      const fallbackArray = [4, 5, 6];
      
      expect(that(originalArray).or(fallbackArray)).toBe(originalArray);
      expect(that(null as number[] | null).or(fallbackArray)).toBe(fallbackArray);
      expect(that(undefined as number[] | undefined).or(fallbackArray)).toBe(fallbackArray);
    });

    it('should work with functions', () => {
      const originalFunction = () => 'original';
      const fallbackFunction = () => 'fallback';
      
      expect(that(originalFunction).or(fallbackFunction)).toBe(originalFunction);
      expect(that(null as typeof originalFunction | null).or(fallbackFunction)).toBe(fallbackFunction);
      expect(that(undefined as typeof originalFunction | undefined).or(fallbackFunction)).toBe(fallbackFunction);
    });

    it('should work with same types', () => {
      expect(that('string').or('fallback')).toBe('string');
      expect(that(null as number | null).or(42)).toBe(42);
      expect(that(undefined as string | undefined).or('fallback')).toBe('fallback');
      expect(that(0).or(99)).toBe(0);
      expect(that(false).or(true)).toBe(false);
    });

    it('should handle nested that calls', () => {
      expect(that(that('value').or('fallback1')).or('fallback2')).toBe('value');
      expect(that(that(null as string | null).or('fallback1')).or('fallback2')).toBe('fallback1');
      expect(that(that(null as string | null).or(null as string | null)).or('fallback2')).toBe('fallback2');
    });

    it('should preserve type safety', () => {
      // String type
      const stringResult: string = that('hello').or('world');
      expect(stringResult).toBe('hello');

      // Number type
      const numberResult: number = that(42).or(0);
      expect(numberResult).toBe(42);

      // Boolean type
      const booleanResult: boolean = that(true).or(false);
      expect(booleanResult).toBe(true);

      // Object type
      interface TestObject {
        name: string;
        age: number;
      }
      const obj1: TestObject = { name: 'John', age: 30 };
      const obj2: TestObject = { name: 'Jane', age: 25 };
      const objectResult: TestObject = that(obj1).or(obj2);
      expect(objectResult).toBe(obj1);
    });

    it('should handle edge cases with special values', () => {
      // NaN is not null or undefined, so it should be returned
      expect(that(NaN).or(42)).toBeNaN();
      
      // Infinity is not null or undefined, so it should be returned
      expect(that(Infinity).or(42)).toBe(Infinity);
      expect(that(-Infinity).or(42)).toBe(-Infinity);
      
      // Date objects
      const date1 = new Date('2023-01-01');
      const date2 = new Date('2023-12-31');
      expect(that(date1).or(date2)).toBe(date1);
      expect(that(null as Date | null).or(date2)).toBe(date2);
    });
  });

  describe('chaining behavior', () => {
    it('should return an object with or method', () => {
      const result = that('value');
      expect(typeof result).toBe('object');
      expect(typeof result.or).toBe('function');
    });

    it('should be chainable with other operations', () => {
      const getValue = (input: string | null) => that(input).or('default');
      
      expect(getValue('test')).toBe('test');
      expect(getValue(null)).toBe('default');
      expect(getValue(undefined as unknown as string | null)).toBe('default');
    });
  });
});
