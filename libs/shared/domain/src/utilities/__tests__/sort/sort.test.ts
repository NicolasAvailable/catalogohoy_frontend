import { sort } from '../../sort/sort';

// Test data interfaces
interface TestUser {
  id: number;
  name: string;
  age: number;
  email: string;
  createdAt: Date;
  profile: {
    department: string;
    level: number;
    settings: {
      theme: string;
      notifications: boolean;
    };
  };
  isActive: boolean;
}

interface TestProduct {
  id: number;
  name: string;
  price: number;
  category: string;
  releaseDate: Date;
  rating: number;
}

describe('sort utility', () => {
  // Test data setup
  const testUsers: TestUser[] = [
    {
      id: 3,
      name: 'Charlie',
      age: 35,
      email: 'charlie@example.com',
      createdAt: new Date('2024-01-15T10:00:00Z'),
      profile: {
        department: 'Sales',
        level: 2,
        settings: {
          theme: 'dark',
          notifications: true
        }
      },
      isActive: true
    },
    {
      id: 1,
      name: 'Alice',
      age: 25,
      email: 'alice@example.com',
      createdAt: new Date('2024-01-10T09:00:00Z'),
      profile: {
        department: 'IT',
        level: 5,
        settings: {
          theme: 'light',
          notifications: false
        }
      },
      isActive: false
    },
    {
      id: 2,
      name: 'Bob',
      age: 30,
      email: 'bob@example.com',
      createdAt: new Date('2024-01-12T14:30:00Z'),
      profile: {
        department: 'IT',
        level: 3,
        settings: {
          theme: 'auto',
          notifications: true
        }
      },
      isActive: true
    }
  ];

  const testProducts: TestProduct[] = [
    {
      id: 1,
      name: 'Laptop',
      price: 999.99,
      category: 'Electronics',
      releaseDate: new Date('2024-01-01'),
      rating: 4.5
    },
    {
      id: 2,
      name: 'Mouse',
      price: 25.50,
      category: 'Electronics',
      releaseDate: new Date('2024-02-15'),
      rating: 4.2
    },
    {
      id: 3,
      name: 'Book',
      price: 15.99,
      category: 'Books',
      releaseDate: new Date('2024-01-20'),
      rating: 4.8
    }
  ];

  describe('Basic sorting functionality', () => {
    it('should sort by string values ascending (default)', () => {
      const result = sort(testUsers).by(user => user.name);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Charlie');
    });

    it('should sort by string values descending', () => {
      const result = sort(testUsers).desc().by(user => user.name);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Charlie');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Alice');
    });

    it('should sort by number values ascending', () => {
      const result = sort(testUsers).asc().by(user => user.age);

      expect(result[0].age).toBe(25);
      expect(result[1].age).toBe(30);
      expect(result[2].age).toBe(35);
    });

    it('should sort by number values descending', () => {
      const result = sort(testUsers).desc().by(user => user.age);

      expect(result[0].age).toBe(35);
      expect(result[1].age).toBe(30);
      expect(result[2].age).toBe(25);
    });

    it('should sort by Date values ascending', () => {
      const result = sort(testUsers).asc().by(user => user.createdAt);

      expect(result[0].createdAt.getTime()).toBe(new Date('2024-01-10T09:00:00Z').getTime());
      expect(result[1].createdAt.getTime()).toBe(new Date('2024-01-12T14:30:00Z').getTime());
      expect(result[2].createdAt.getTime()).toBe(new Date('2024-01-15T10:00:00Z').getTime());
    });

    it('should sort by Date values descending', () => {
      const result = sort(testUsers).desc().by(user => user.createdAt);

      expect(result[0].createdAt.getTime()).toBe(new Date('2024-01-15T10:00:00Z').getTime());
      expect(result[1].createdAt.getTime()).toBe(new Date('2024-01-12T14:30:00Z').getTime());
      expect(result[2].createdAt.getTime()).toBe(new Date('2024-01-10T09:00:00Z').getTime());
    });
  });

  describe('byProperty sorting', () => {
    it('should sort by simple property path', () => {
      const result = sort(testUsers).asc().byProperty('name');

      expect(result[0].name).toBe('Alice');
      expect(result[1].name).toBe('Bob');
      expect(result[2].name).toBe('Charlie');
    });

    it('should sort by nested property path', () => {
      const result = sort(testUsers).asc().byProperty('profile.department');

      expect(result[0].profile.department).toBe('IT');
      expect(result[1].profile.department).toBe('IT');
      expect(result[2].profile.department).toBe('Sales');
    });

    it('should sort by deeply nested property path', () => {
      const result = sort(testUsers).asc().byProperty('profile.settings.theme');

      expect(result[0].profile.settings.theme).toBe('auto');
      expect(result[1].profile.settings.theme).toBe('dark');
      expect(result[2].profile.settings.theme).toBe('light');
    });

    it('should sort by numeric nested property', () => {
      const result = sort(testUsers).desc().byProperty('profile.level');

      expect(result[0].profile.level).toBe(5);
      expect(result[1].profile.level).toBe(3);
      expect(result[2].profile.level).toBe(2);
    });

    it('should handle non-existent property paths', () => {
      const result = sort(testUsers).asc().byProperty('nonExistent.property');

      expect(result).toHaveLength(3);
      // Should not throw error, order may be unpredictable but array should be intact
    });
  });

  describe('byCustom sorting', () => {
    it('should sort using custom comparator function ascending', () => {
      const result = sort(testProducts).asc().byCustom((a, b) => a.price - b.price);

      expect(result[0].price).toBe(15.99);
      expect(result[1].price).toBe(25.50);
      expect(result[2].price).toBe(999.99);
    });

    it('should sort using custom comparator function descending', () => {
      const result = sort(testProducts).desc().byCustom((a, b) => a.price - b.price);

      expect(result[0].price).toBe(999.99);
      expect(result[1].price).toBe(25.50);
      expect(result[2].price).toBe(15.99);
    });

    it('should sort using complex custom logic', () => {
      // Sort by category first, then by price within category
      const result = sort(testProducts).asc().byCustom((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.price - b.price;
      });

      expect(result[0].category).toBe('Books');
      expect(result[1].category).toBe('Electronics');
      expect(result[2].category).toBe('Electronics');
      expect(result[1].price).toBe(25.50); // Cheaper electronics first
      expect(result[2].price).toBe(999.99);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle empty arrays', () => {
      const result = sort([]).by(() => 'key');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle single item arrays', () => {
      const singleUser = [testUsers[0]];
      const result = sort(singleUser).by(user => user.name);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe(testUsers[0]);
    });

    it('should not mutate original array', () => {
      const original = [...testUsers];
      const originalOrder = original.map(u => u.name);

      sort(original).desc().by(user => user.name);

      expect(original.map(u => u.name)).toEqual(originalOrder);
    });

    it('should handle mixed data types gracefully', () => {
      const mixedData = [
        { value: 'string' },
        { value: 42 },
        { value: new Date('2024-01-01') }
      ];

      const result = sort(mixedData).by(item => item.value as any);

      expect(result).toHaveLength(3);
      expect(result).toBeInstanceOf(Array);
    });

    it('should handle null and undefined values', () => {
      const dataWithNulls = [
        { name: 'Alice', value: null },
        { name: 'Bob', value: undefined },
        { name: 'Charlie', value: 'valid' }
      ];

      const result = sort(dataWithNulls).by(item => item.name);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Alice');
    });
  });

  describe('Fluent API behavior', () => {
    it('should allow method chaining with asc()', () => {
      const result = sort(testUsers).asc().by(user => user.age);

      expect(result[0].age).toBe(25);
      expect(result[2].age).toBe(35);
    });

    it('should allow method chaining with desc()', () => {
      const result = sort(testUsers).desc().by(user => user.age);

      expect(result[0].age).toBe(35);
      expect(result[2].age).toBe(25);
    });

    it('should default to ascending when no order specified', () => {
      const resultDefault = sort(testUsers).by(user => user.age);
      const resultExplicit = sort(testUsers).asc().by(user => user.age);

      expect(resultDefault).toEqual(resultExplicit);
    });

    it('should work with all three sorting methods', () => {
      const byResult = sort(testUsers).asc().by(user => user.name);
      const byPropertyResult = sort(testUsers).asc().byProperty('name');
      const byCustomResult = sort(testUsers).asc().byCustom((a, b) => a.name.localeCompare(b.name));

      expect(byResult).toEqual(byPropertyResult);
      expect(byResult).toEqual(byCustomResult);
    });
  });

  describe('Performance and large datasets', () => {
    it('should handle large datasets efficiently', () => {
      const largeDataset = Array.from({ length: 1000 }, (_, i) => ({
        id: i,
        name: `User${i}`,
        value: Math.random() * 1000
      }));

      const startTime = Date.now();
      const result = sort(largeDataset).by(item => item.value);
      const endTime = Date.now();

      expect(result).toHaveLength(1000);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
      
      // Verify it's actually sorted
      for (let i = 1; i < result.length; i++) {
        expect(result[i].value).toBeGreaterThanOrEqual(result[i - 1].value);
      }
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should sort users by creation date for admin dashboard', () => {
      const result = sort(testUsers).desc().by(user => user.createdAt);

      expect(result[0].name).toBe('Charlie'); // Most recent
      expect(result[2].name).toBe('Alice');   // Oldest
    });

    it('should sort products by price for e-commerce listing', () => {
      const result = sort(testProducts).asc().by(product => product.price);

      expect(result[0].name).toBe('Book');   // Cheapest
      expect(result[2].name).toBe('Laptop'); // Most expensive
    });

    it('should sort by nested department for organizational chart', () => {
      const result = sort(testUsers).asc().byProperty('profile.department');

      const departments = result.map(u => u.profile.department);
      expect(departments).toEqual(['IT', 'IT', 'Sales']);
    });

    it('should sort by complex business logic', () => {
      // Sort active users first, then by level descending
      const result = sort(testUsers).desc().byCustom((a, b) => {
        if (a.isActive !== b.isActive) {
          return a.isActive ? -1 : 1; // Active users first
        }
        return b.profile.level - a.profile.level; // Higher level first
      });

      expect(result[0].isActive).toBe(true);
      expect(result[0].profile.level).toBe(2); // Charlie (active, level 2)
      expect(result[1].isActive).toBe(true);
      expect(result[1].profile.level).toBe(3); // Bob (active, level 3)
      expect(result[2].isActive).toBe(false);   // Alice (inactive)
    });
  });

  describe('Type safety and TypeScript integration', () => {
    it('should maintain type safety with generic arrays', () => {
      const numbers = [3, 1, 4, 1, 5];
      const result = sort(numbers).by(n => n);

      expect(result).toEqual([1, 1, 3, 4, 5]);
      expect(typeof result[0]).toBe('number');
    });

    it('should work with different object types', () => {
      interface SimpleItem {
        key: string;
        value: number;
      }

      const items: SimpleItem[] = [
        { key: 'c', value: 3 },
        { key: 'a', value: 1 },
        { key: 'b', value: 2 }
      ];

      const byKey = sort(items).by(item => item.key);
      const byValue = sort(items).by(item => item.value);

      expect(byKey[0].key).toBe('a');
      expect(byValue[0].value).toBe(1);
    });
  });
});
