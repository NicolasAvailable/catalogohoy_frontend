import { random } from '../../random/random';

describe('random', () => {
  describe('int', () => {
    it('should generate a random integer within the specified range', () => {
      const min = 5;
      const max = 10;

      for (let i = 0; i < 100; i++) {
        const result = random.int(min, max);
        expect(Number.isInteger(result)).toBe(true);
        expect(result).toBeGreaterThanOrEqual(min);
        expect(result).toBeLessThanOrEqual(max);
      }
    });

    it('should throw an error if min is greater than max', () => {
      expect(() => random.int(10, 5)).toThrow('The min value must be less than the max.');
    });
  });

  describe('from', () => {
    it('should return a random element from the array', () => {
      const testArray = [1, 2, 3, 4, 5];

      for (let i = 0; i < 100; i++) {
        const result = random.from(testArray);
        expect(testArray).toContain(result);
      }
    });

    it('should throw an error for an empty array', () => {
      expect(() => random.from([])).toThrow('The array must not be empty.');
    });

    it('should work with arrays of different types', () => {
      const stringArray = ['a', 'b', 'c'];
      const objectArray = [{ id: 1 }, { id: 2 }, { id: 3 }];

      const stringResult = random.from(stringArray);
      const objectResult = random.from(objectArray);

      expect(stringArray).toContain(stringResult);
      expect(objectArray).toContain(objectResult);
    });
  });
});
