import { object } from '../../object/object';

describe('object utility', () => {
  describe('clone', () => {
    it('should create a deep clone of an object', () => {
      const original = { a: 1, b: { c: 2 } };
      const cloned = object.clone(original);

      expect(cloned).toEqual(original);
      expect(cloned).not.toBe(original);
      expect(cloned.b).not.toBe(original.b);
    });

    it('should handle null and undefined', () => {
      expect(object.clone(null as unknown as object)).toBeNull();
      expect(object.clone(undefined as unknown as object)).toBeUndefined();
    });
  });

  describe('merge', () => {
    it('should deeply merge two objects', () => {
      const target = { a: 1, b: { c: 2, d: 3 } };
      const source = { b: { c: 4 }, e: 5 };
      const merged = object.merge(target, source);

      expect(merged).toEqual({
        a: 1,
        b: { c: 4, d: 3 },
        e: 5,
      });

      expect(target).toEqual({ a: 1, b: { c: 2, d: 3 } });
      expect(source).toEqual({ b: { c: 4 }, e: 5 });
    });

    it('should handle empty objects', () => {
      expect(object.merge({}, {})).toEqual({});
      expect(object.merge({ a: 1 }, {})).toEqual({ a: 1 });
      expect(object.merge({}, { a: 1 })).toEqual({ a: 1 });
    });
  });

  describe('all.empty', () => {
    it('should check if all object values are empty', () => {
      expect(object.all.empty({}).isRight()).toBe(true);
      expect(object.all.empty({ a: null, b: undefined, c: '' }).isRight()).toBe(true);
      expect(object.all.empty({ a: ' ', b: '\t\n' }).isRight()).toBe(false);
      expect(object.all.empty({ a: 0, b: false }).isRight()).toBe(false);
      expect(object.all.empty({ a: 'value' }).isRight()).toBe(false);
    });
  });

  describe('array.uniqueById', () => {
    it('should merge two arrays and remove duplicates by id', () => {
      const origin = [
        { id: 1, name: 'John' },
        { id: 2, name: 'Jane' },
      ];
      const target = [
        { id: 2, name: 'Jane Updated' },
        { id: 3, name: 'Bob' },
      ];

      const result = object.array.uniqueById(origin, target);

      expect(result).toHaveLength(3);

      expect(result[0]).toEqual({ id: 2, name: 'Jane Updated' }); // Keeps target occurrence
      expect(result[1]).toEqual({ id: 3, name: 'Bob' });
      expect(result[2]).toEqual({ id: 1, name: 'John' });
    });

    it('should handle empty arrays', () => {
      const origin = [{ id: 1, name: 'John' }];
      const target: typeof origin = [];

      expect(object.array.uniqueById(origin, target)).toEqual(origin);
      expect(object.array.uniqueById([], origin)).toEqual(origin);
      expect(object.array.uniqueById([], [])).toEqual([]);
    });

    it('should work with string ids', () => {
      const origin = [
        { id: 'a', value: 10 },
        { id: 'b', value: 20 },
      ];
      const target = [
        { id: 'b', value: 25 },
        { id: 'c', value: 30 },
      ];

      const result = object.array.uniqueById(origin, target);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: 'b', value: 25 }); // Keeps target occurrence
      expect(result[1]).toEqual({ id: 'c', value: 30 });
      expect(result[2]).toEqual({ id: 'a', value: 10 });
    });

    it('should not modify original arrays', () => {
      const origin = [{ id: 1, name: 'John' }];
      const target = [{ id: 2, name: 'Jane' }];
      const originalOrigin = [...origin];
      const originalTarget = [...target];

      object.array.uniqueById(origin, target);

      expect(origin).toEqual(originalOrigin);
      expect(target).toEqual(originalTarget);
    });

    it('should handle complex objects with nested properties', () => {
      const origin = [{ id: 1, user: { name: 'John', age: 30 }, active: true }];
      const target = [
        { id: 1, user: { name: 'John Updated', age: 31 }, active: false },
        { id: 2, user: { name: 'Jane', age: 25 }, active: true },
      ];

      const result = object.array.uniqueById(origin, target);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, user: { name: 'John Updated', age: 31 }, active: false });
      expect(result[1]).toEqual({ id: 2, user: { name: 'Jane', age: 25 }, active: true });
    });
  });

  describe('getValue', () => {
    const testObject = {
      name: 'John',
      age: 30,
      user: {
        profile: {
          email: 'john@example.com',
          settings: {
            theme: 'dark',
            notifications: true
          }
        },
        roles: ['admin', 'user']
      },
      metadata: {
        level: 5,
        department: 'IT'
      }
    };

    it('should get simple property values', () => {
      expect(object.getValue(testObject, 'name')).toBe('John');
      expect(object.getValue(testObject, 'age')).toBe(30);
    });

    it('should get nested property values', () => {
      expect(object.getValue(testObject, 'user.profile.email')).toBe('john@example.com');
      expect(object.getValue(testObject, 'metadata.level')).toBe(5);
      expect(object.getValue(testObject, 'metadata.department')).toBe('IT');
    });

    it('should get deeply nested property values', () => {
      expect(object.getValue(testObject, 'user.profile.settings.theme')).toBe('dark');
      expect(object.getValue(testObject, 'user.profile.settings.notifications')).toBe(true);
    });

    it('should return undefined for non-existent properties', () => {
      expect(object.getValue(testObject, 'nonExistent')).toBeUndefined();
      expect(object.getValue(testObject, 'user.nonExistent')).toBeUndefined();
      expect(object.getValue(testObject, 'user.profile.nonExistent')).toBeUndefined();
      expect(object.getValue(testObject, 'user.profile.settings.nonExistent')).toBeUndefined();
    });

    it('should return undefined for invalid paths', () => {
      expect(object.getValue(testObject, 'name.invalid')).toBeUndefined();
      expect(object.getValue(testObject, 'age.invalid.path')).toBeUndefined();
    });

    it('should handle empty string path', () => {
      expect(object.getValue(testObject, '')).toBeUndefined();
    });

    it('should handle array properties', () => {
      expect(object.getValue(testObject, 'user.roles')).toEqual(['admin', 'user']);
    });

    it('should handle null and undefined values in path', () => {
      const objWithNulls = {
        data: null,
        info: undefined,
        nested: {
          value: null
        }
      };

      expect(object.getValue(objWithNulls, 'data')).toBeNull();
      expect(object.getValue(objWithNulls, 'info')).toBeUndefined();
      expect(object.getValue(objWithNulls, 'nested.value')).toBeNull();
      expect(object.getValue(objWithNulls, 'data.invalid')).toBeUndefined();
      expect(object.getValue(objWithNulls, 'info.invalid')).toBeUndefined();
    });

    it('should handle empty objects', () => {
      expect(object.getValue({}, 'any.path')).toBeUndefined();
      expect(object.getValue({}, 'simple')).toBeUndefined();
    });

    it('should handle objects with numeric keys', () => {
      const objWithNumbers = {
        0: 'zero',
        1: { nested: 'value' },
        user: { 0: 'first', 1: 'second' }
      };

      expect(object.getValue(objWithNumbers, '0')).toBe('zero');
      expect(object.getValue(objWithNumbers, '1.nested')).toBe('value');
      expect(object.getValue(objWithNumbers, 'user.0')).toBe('first');
      expect(object.getValue(objWithNumbers, 'user.1')).toBe('second');
    });

    it('should handle special characters in property names', () => {
      const objWithSpecialChars = {
        'special-key': 'value1',
        'key with spaces': 'value2',
        'keyWithoutDots': 'value3',
        nested: {
          'special-nested': 'nested-value'
        }
      };

      expect(object.getValue(objWithSpecialChars, 'special-key')).toBe('value1');
      expect(object.getValue(objWithSpecialChars, 'key with spaces')).toBe('value2');
      expect(object.getValue(objWithSpecialChars, 'keyWithoutDots')).toBe('value3');
      expect(object.getValue(objWithSpecialChars, 'nested.special-nested')).toBe('nested-value');
    });

    it('should handle keys with dots as path separators', () => {
      const objWithDots = {
        key: {
          with: {
            dots: 'nested-value'
          }
        }
      };

      // Dots are interpreted as path separators, not literal characters
      expect(object.getValue(objWithDots, 'key.with.dots')).toBe('nested-value');
    });

    it('should handle boolean and numeric values', () => {
      const objWithPrimitives = {
        isActive: true,
        isDisabled: false,
        count: 0,
        price: 99.99,
        nested: {
          flag: false,
          zero: 0
        }
      };

      expect(object.getValue(objWithPrimitives, 'isActive')).toBe(true);
      expect(object.getValue(objWithPrimitives, 'isDisabled')).toBe(false);
      expect(object.getValue(objWithPrimitives, 'count')).toBe(0);
      expect(object.getValue(objWithPrimitives, 'price')).toBe(99.99);
      expect(object.getValue(objWithPrimitives, 'nested.flag')).toBe(false);
      expect(object.getValue(objWithPrimitives, 'nested.zero')).toBe(0);
    });
  });
});
