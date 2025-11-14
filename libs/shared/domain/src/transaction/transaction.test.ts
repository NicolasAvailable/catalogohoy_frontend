import * as E from '@sweet-monads/either';
import { Transaction, transaction } from './transaction';

describe('Transaction', () => {
  describe('run', () => {
    it('should return success result without rolling back when operation succeeds', async () => {
      const target = { name: 'test', value: 123 };
      const tx = new Transaction(target);

      target.name = 'modified';

      const result = await tx.run(async () => E.right('success'));

      expect(result.value).toBe('success');
      expect(target.name).toBe('modified');
    });

    it('should roll back changes when operation fails', async () => {
      const target = { name: 'test', value: 123 };
      const tx = new Transaction(target);

      const initialState = { ...target };

      target.name = 'modified';
      target.value = 456;

      const result = await tx.run(async () => E.left(new Error('Operation failed')));

      expect(result.isLeft()).toBe(true);
      expect(target).toEqual(initialState);
    });

    it('should handle async operations correctly', async () => {
      const target = { counter: 0 };
      const tx = new Transaction(target);

      target.counter = 100;

      const result = await tx.run(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return E.left(new Error('Async failure'));
      });

      expect(target.counter).toBe(0);
      expect(result.isLeft()).toBe(true);
    });
  });

  describe('transaction helper', () => {
    it('should create a new Transaction instance', () => {
      const target = { data: 'test' };
      const tx = transaction(target);

      expect(tx).toBeInstanceOf(Transaction);
    });

    it('should work with the transaction helper', async () => {
      const target = { value: 1 };
      const tx = transaction(target);

      target.value = 2;

      const result = await tx.run(async () => E.left(new Error('Failed')));

      expect(result.isLeft()).toBe(true);
      expect(target.value).toBe(1);
    });
  });

  it('should handle nested objects correctly', async () => {
    const target = {
      user: {
        name: 'test',
        settings: { theme: { color: 'light' } },
      },
    };

    const tx = new Transaction(target);
    const initialState = JSON.parse(JSON.stringify(target));

    target.user.name = 'modified';
    target.user.settings.theme.color = 'dark';

    const result = await tx.run(async () => E.left(new Error('Failed')));

    expect(result.isLeft()).toBe(true);
    expect(target).toEqual(initialState);
  });
});
