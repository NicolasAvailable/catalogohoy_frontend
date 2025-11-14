import { $promises } from '../../promises/promises';

describe('$promises', () => {
  describe('allSettled', () => {
    it('should return only successful results', async () => {
      const promise1 = Promise.resolve('success1');
      const promise2 = Promise.reject(new Error('error1'));
      const promise3 = Promise.resolve('success2');
      const promise4 = Promise.reject(new Error('error2'));

      const result = await $promises.onlySuccessful([promise1, promise2, promise3, promise4]);

      expect(result).toEqual(['success1', 'success2']);
      expect(result).toHaveLength(2);
    });

    it('should return empty array when all promises fail', async () => {
      const promise1 = Promise.reject(new Error('error1'));
      const promise2 = Promise.reject(new Error('error2'));

      const result = await $promises.onlySuccessful([promise1, promise2]);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should return all results when all promises succeed', async () => {
      const promise1 = Promise.resolve('success1');
      const promise2 = Promise.resolve('success2');
      const promise3 = Promise.resolve('success3');

      const result = await $promises.onlySuccessful([promise1, promise2, promise3]);

      expect(result).toEqual(['success1', 'success2', 'success3']);
      expect(result).toHaveLength(3);
    });

    it('should handle empty array', async () => {
      const result = await $promises.onlySuccessful([]);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should work with different data types', async () => {
      const promise1: Promise<number> = Promise.resolve(42);
      const promise2: Promise<number> = Promise.reject(new Error('error'));
      const promise3: Promise<number> = Promise.resolve(100);

      const result = await $promises.onlySuccessful([promise1, promise2, promise3]);

      expect(result).toEqual([42, 100]);
      expect(result).toHaveLength(2);
    });

    it('should work with object types', async () => {
      const promise1 = Promise.resolve({ id: 1, name: 'test' });
      const promise2 = Promise.resolve({ id: 2, name: 'test2' });
      const promise3 = Promise.reject(new Error('error'));

      const result = await $promises.onlySuccessful([promise1, promise2, promise3]);

      expect(result).toEqual([
        { id: 1, name: 'test' },
        { id: 2, name: 'test2' },
      ]);
      expect(result).toHaveLength(2);
    });

    it('should handle promises that resolve with undefined', async () => {
      const promise1: Promise<string | undefined> = Promise.resolve(undefined);
      const promise2: Promise<string | undefined> = Promise.resolve('success');
      const promise3: Promise<string | undefined> = Promise.reject(new Error('error'));

      const result = await $promises.onlySuccessful([promise1, promise2, promise3]);

      expect(result).toEqual([undefined, 'success']);
      expect(result).toHaveLength(2);
    });
  });

  describe('allSettledWithErrors', () => {
    it('should return both successes and errors', async () => {
      const promise1 = Promise.resolve('success1');
      const promise2 = Promise.reject(new Error('error1'));
      const promise3 = Promise.resolve('success2');
      const promise4 = Promise.reject(new Error('error2'));

      const result = await $promises.all([promise1, promise2, promise3, promise4]);

      expect(result.successes).toEqual(['success1', 'success2']);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect(result.errors[1]).toBeInstanceOf(Error);
      expect((result.errors[0] as Error).message).toBe('error1');
      expect((result.errors[1] as Error).message).toBe('error2');
    });

    it('should return only successes when no errors', async () => {
      const promise1 = Promise.resolve('success1');
      const promise2 = Promise.resolve('success2');

      const result = await $promises.all([promise1, promise2]);

      expect(result.successes).toEqual(['success1', 'success2']);
      expect(result.errors).toEqual([]);
    });

    it('should return only errors when no successes', async () => {
      const promise1 = Promise.reject(new Error('error1'));
      const promise2 = Promise.reject(new Error('error2'));

      const result = await $promises.all([promise1, promise2]);

      expect(result.successes).toEqual([]);
      expect(result.errors).toHaveLength(2);
      expect((result.errors[0] as Error).message).toBe('error1');
      expect((result.errors[1] as Error).message).toBe('error2');
    });

    it('should handle empty array', async () => {
      const result = await $promises.all([]);

      expect(result.successes).toEqual([]);
      expect(result.errors).toEqual([]);
    });

    it('should handle different error types', async () => {
      const promise1 = Promise.resolve('success');
      const promise2 = Promise.reject(new Error('error'));
      const promise3 = Promise.reject('string error');
      const promise4 = Promise.reject({ code: 'CUSTOM_ERROR' });

      const result = await $promises.all([promise1, promise2, promise3, promise4]);

      expect(result.successes).toEqual(['success']);
      expect(result.errors).toHaveLength(3);
      expect(result.errors[0]).toBeInstanceOf(Error);
      expect(result.errors[1]).toBe('string error');
      expect(result.errors[2]).toEqual({ code: 'CUSTOM_ERROR' });
    });
  });
});
