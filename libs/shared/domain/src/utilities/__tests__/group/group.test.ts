import { $group, group, GroupedItem } from '../../group/group';

// Test data interfaces
interface TestPost {
  id: number;
  title: string;
  date: Date;
  status: 'draft' | 'published' | 'archived';
  author: {
    name: string;
    type: 'admin' | 'user';
  };
  tags: string[];
}

interface TestUser {
  id: number;
  name: string;
  email: string;
  role: string;
  createdAt: Date;
  metadata: {
    department: string;
    level: number;
  };
}

describe('Group Utility', () => {
  // Test data setup
  const testPosts: TestPost[] = [
    {
      id: 1,
      title: 'Post 1',
      date: new Date('2024-01-15T09:00:00Z'),
      status: 'published',
      author: { name: 'John', type: 'admin' },
      tags: ['tech', 'news'],
    },
    {
      id: 2,
      title: 'Post 2',
      date: new Date('2024-01-15T14:00:00Z'),
      status: 'published',
      author: { name: 'Jane', type: 'user' },
      tags: ['tech', 'tutorial'],
    },
    {
      id: 3,
      title: 'Post 3',
      date: new Date('2024-01-16T10:00:00Z'),
      status: 'draft',
      author: { name: 'Bob', type: 'user' },
      tags: ['news'],
    },
    {
      id: 4,
      title: 'Post 4',
      date: new Date('2024-01-16T15:00:00Z'),
      status: 'archived',
      author: { name: 'Alice', type: 'admin' },
      tags: ['tutorial'],
    },
  ];

  const testUsers: TestUser[] = [
    {
      id: 1,
      name: 'John Doe',
      email: 'john@example.com',
      role: 'admin',
      createdAt: new Date('2024-01-01T00:00:00Z'),
      metadata: { department: 'IT', level: 5 },
    },
    {
      id: 2,
      name: 'Jane Smith',
      email: 'jane@example.com',
      role: 'user',
      createdAt: new Date('2024-01-02T00:00:00Z'),
      metadata: { department: 'IT', level: 3 },
    },
    {
      id: 3,
      name: 'Bob Johnson',
      email: 'bob@example.com',
      role: 'user',
      createdAt: new Date('2024-02-01T00:00:00Z'),
      metadata: { department: 'Sales', level: 2 },
    },
  ];

  describe('$group.by', () => {
    it('should group items by simple string key', () => {
      const result = $group.by(testPosts, (post) => post.status);

      expect(result).toHaveLength(3);
      expect(result.find((g) => g.key === 'published')?.items).toHaveLength(2);
      expect(result.find((g) => g.key === 'draft')?.items).toHaveLength(1);
      expect(result.find((g) => g.key === 'archived')?.items).toHaveLength(1);
    });

    it('should group items by computed key', () => {
      const result = $group.by(testPosts, (post) => post.author.type);

      expect(result).toHaveLength(2);
      expect(result.find((g) => g.key === 'admin')?.items).toHaveLength(2);
      expect(result.find((g) => g.key === 'user')?.items).toHaveLength(2);
    });

    it('should handle empty arrays', () => {
      const result = $group.by([], () => 'key');

      expect(result).toHaveLength(0);
      expect(result).toEqual([]);
    });

    it('should handle single item', () => {
      const result = $group.by([testPosts[0]], (post) => post.status);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('published');
      expect(result[0].items).toHaveLength(1);
    });

    it('should preserve original key when option is enabled', () => {
      const result = $group.by(testPosts, (post) => post.date.toISOString().split('T')[0], {
        preserveOriginalKey: true,
      });

      expect(result).toHaveLength(2);
      expect(result.every((group) => group.key.includes('2024-01'))).toBe(true);
    });

    it('should sort by key ascending', () => {
      const result = $group.by(testPosts, (post) => post.status, { sortBy: 'key', sortOrder: 'asc' });

      expect(result[0].key).toBe('archived');
      expect(result[1].key).toBe('draft');
      expect(result[2].key).toBe('published');
    });

    it('should sort by key descending', () => {
      const result = $group.by(testPosts, (post) => post.status, { sortBy: 'key', sortOrder: 'desc' });

      expect(result[0].key).toBe('published');
      expect(result[1].key).toBe('draft');
      expect(result[2].key).toBe('archived');
    });

    it('should sort by count ascending', () => {
      const result = $group.by(testPosts, (post) => post.status, { sortBy: 'count', sortOrder: 'asc' });

      expect(result[0].items).toHaveLength(1); // draft or archived
      expect(result[2].items).toHaveLength(2); // published
    });

    it('should sort by count descending', () => {
      const result = $group.by(testPosts, (post) => post.status, { sortBy: 'count', sortOrder: 'desc' });

      expect(result[0].items).toHaveLength(2); // published
      expect(result[1].items).toHaveLength(1); // draft or archived
      expect(result[2].items).toHaveLength(1); // draft or archived
    });

    it('should sort by custom function', () => {
      const result = $group.by(testPosts, (post) => post.status, {
        sortBy: (a, b) => a.key.length - b.key.length,
        sortOrder: 'asc',
      });

      expect(result[0].key).toBe('draft'); // 5 chars
      expect(result[1].key).toBe('archived'); // 8 chars
      expect(result[2].key).toBe('published'); // 9 chars
    });
  });

  describe('$group.byDate', () => {
    it('should group by day format', () => {
      const result = $group.byDate(testPosts, (post) => post.date, 'day');

      expect(result).toHaveLength(2);
      expect(result.find((g) => g.key === '2024-01-15')?.items).toHaveLength(2);
      expect(result.find((g) => g.key === '2024-01-16')?.items).toHaveLength(2);
    });

    it('should group by week format', () => {
      const result = $group.byDate(testPosts, (post) => post.date, 'week');

      expect(result).toHaveLength(1);
      // All posts from Jan 15-16, 2024 should be in the same week (starting Jan 14, 2024)
      expect(result[0].key).toBe('2024-01-14'); // Week starts on Sunday
      expect(result[0].items).toHaveLength(4);
    });

    it('should group by month format', () => {
      const result = $group.byDate(testPosts, (post) => post.date, 'month');

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('2024-01');
      expect(result[0].items).toHaveLength(4);
    });

    it('should group by year format', () => {
      const result = $group.byDate(testPosts, (post) => post.date, 'year');

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('2024');
      expect(result[0].items).toHaveLength(4);
    });

    it('should group by custom date format function', () => {
      const quarterFormatter = (date: Date) => `${date.getFullYear()}-Q${Math.floor(date.getMonth() / 3) + 1}`;

      const result = $group.byDate(testPosts, (post) => post.date, quarterFormatter);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('2024-Q1');
      expect(result[0].items).toHaveLength(4);
    });

    it('should handle mixed dates across months', () => {
      const mixedDatePosts = [
        { ...testPosts[0], date: new Date('2024-01-15') },
        { ...testPosts[1], date: new Date('2024-02-15') },
        { ...testPosts[2], date: new Date('2024-03-15') },
      ];

      const result = $group.byDate(mixedDatePosts, (post) => post.date, 'month');

      expect(result).toHaveLength(3);
      expect(result.find((g) => g.key === '2024-01')?.items).toHaveLength(1);
      expect(result.find((g) => g.key === '2024-02')?.items).toHaveLength(1);
      expect(result.find((g) => g.key === '2024-03')?.items).toHaveLength(1);
    });
  });

  describe('$group.byProperty', () => {
    it('should group by simple property', () => {
      const result = $group.byProperty(testUsers, 'role');

      expect(result).toHaveLength(2);
      expect(result.find((g) => g.key === 'admin')?.items).toHaveLength(1);
      expect(result.find((g) => g.key === 'user')?.items).toHaveLength(2);
    });

    it('should group by nested property', () => {
      const result = $group.byProperty(testUsers, 'metadata.department');

      expect(result).toHaveLength(2);
      expect(result.find((g) => g.key === 'IT')?.items).toHaveLength(2);
      expect(result.find((g) => g.key === 'Sales')?.items).toHaveLength(1);
    });

    it('should handle missing nested properties', () => {
      const usersWithMissingData = [
        ...testUsers,
        { ...testUsers[0], metadata: {} as { department?: string; level?: number } },
      ];

      const result = $group.byProperty(usersWithMissingData, 'metadata.department');

      expect(result).toHaveLength(3);
      expect(result.find((g) => g.key === 'undefined')?.items).toHaveLength(1);
    });

    it('should handle deep nested properties', () => {
      const result = $group.byProperty(testUsers, 'metadata.level');

      expect(result).toHaveLength(3);
      expect(result.find((g) => g.key === '5')?.items).toHaveLength(1);
      expect(result.find((g) => g.key === '3')?.items).toHaveLength(1);
      expect(result.find((g) => g.key === '2')?.items).toHaveLength(1);
    });
  });

  describe('$group.byMultiple', () => {
    it('should group by multiple keys', () => {
      const result = $group.byMultiple(testPosts, [
        (post) => post.date.toISOString().split('T')[0],
        (post) => post.status,
      ]);

      expect(result).toHaveLength(2); // 2 dates
      expect(result[0].items).toBeInstanceOf(Array);
    });

    it('should handle single key extractor', () => {
      const result = $group.byMultiple(testPosts, [(post) => post.status]);

      expect(result).toHaveLength(3);
      expect(result.find((g) => g.key === 'published')?.items).toHaveLength(2);
    });

    it('should handle empty key extractors', () => {
      const result = $group.byMultiple(testPosts, []);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('all');
      expect(result[0].items).toHaveLength(4);
    });
  });

  describe('$group utility functions', () => {
    const groupedData: GroupedItem<TestPost>[] = [
      { key: 'published', items: [testPosts[0], testPosts[1]] },
      { key: 'draft', items: [testPosts[2]] },
      { key: 'archived', items: [testPosts[3]] },
    ];

    describe('sort', () => {
      it('should sort by key ascending', () => {
        const result = $group.sort(groupedData, 'key', 'asc');

        expect(result[0].key).toBe('archived');
        expect(result[1].key).toBe('draft');
        expect(result[2].key).toBe('published');
      });

      it('should sort by count descending', () => {
        const result = $group.sort(groupedData, 'count', 'desc');

        expect(result[0].items).toHaveLength(2);
        expect(result[1].items).toHaveLength(1);
        expect(result[2].items).toHaveLength(1);
      });

      it('should sort by custom function', () => {
        const result = $group.sort(groupedData, (a, b) => a.key.length - b.key.length, 'asc');

        expect(result[0].key).toBe('draft');
        expect(result[1].key).toBe('archived');
        expect(result[2].key).toBe('published');
      });
    });
  });

  describe('group (simplified API)', () => {
    describe('by', () => {
      it('should group items by key extractor', () => {
        const result = group.by(testPosts, (post) => post.status);

        expect(result).toHaveLength(3);
        expect(result.find((g) => g.key === 'published')?.items).toHaveLength(2);
      });
    });

    describe('byDate', () => {
      it('should group by day by default', () => {
        const result = group.byDate(testPosts, (post) => post.date);

        expect(result).toHaveLength(2);
        expect(result.find((g) => g.key === '2024-01-15')?.items).toHaveLength(2);
      });

      it('should group by specified format', () => {
        const result = group.byDate(testPosts, (post) => post.date, 'month');

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('2024-01');
      });
    });

    describe('byProperty', () => {
      it('should group by property path', () => {
        const result = group.byProperty(testUsers, 'role');

        expect(result).toHaveLength(2);
        expect(result.find((g) => g.key === 'admin')?.items).toHaveLength(1);
      });
    });

    describe('byFullDate', () => {
      it('should group by full date format (Spanish)', () => {
        const result = group.byFullDate(testPosts, (post) => post.date);

        expect(result).toHaveLength(2);
        expect(result.every((group) => group.key.includes('enero') || group.key.includes('January'))).toBe(true);
      });

      it('should preserve original key when using fullDate', () => {
        const result = group.byFullDate(testPosts, (post) => post.date);

        // Should use preserveOriginalKey: true internally
        expect(result).toHaveLength(2);
        expect(result[0].key).toContain('lunes'); // Monday in Spanish
        expect(result[1].key).toContain('martes'); // Tuesday in Spanish
      });
    });
  });

  describe('Edge cases and error handling', () => {
    it('should handle null/undefined dates gracefully', () => {
      const postsWithNullDates = [
        { ...testPosts[0], date: null as unknown as Date },
        { ...testPosts[1], date: undefined as unknown as Date },
        testPosts[2],
      ];

      expect(() => {
        $group.byDate(postsWithNullDates, (post) => post.date || new Date(), 'day');
      }).not.toThrow();
    });

    it('should handle items with same key', () => {
      const duplicateStatusPosts = testPosts.map((post) => ({ ...post, status: 'published' as const }));
      const result = $group.by(duplicateStatusPosts, (post) => post.status);

      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('published');
      expect(result[0].items).toHaveLength(4);
    });

    it('should handle complex nested grouping', () => {
      const result = $group.byMultiple(testPosts, [
        (post) => post.author.type,
        (post) => post.status,
        (post) => post.date.toISOString().split('T')[0],
      ]);

      expect(result).toHaveLength(2); // admin, user
      expect(result.every((group) => Array.isArray(group.items))).toBe(true);
    });

    it('should preserve item references', () => {
      const result = $group.by(testPosts, (post) => post.status);
      const publishedGroup = result.find((g) => g.key === 'published');

      expect(publishedGroup?.items[0]).toBe(testPosts[0]);
      expect(publishedGroup?.items[1]).toBe(testPosts[1]);
    });

    describe('Missing functionality tests', () => {
      it('should handle invalid sort type gracefully', () => {
        const groupedData: GroupedItem<TestPost>[] = [
          { key: 'published', items: [testPosts[0], testPosts[1]] },
          { key: 'draft', items: [testPosts[2]] },
        ];

        // Test with invalid sort type (should return original groups)
        const result = $group.sort(groupedData, 'invalid' as 'key' | 'count', 'asc');
        
        expect(result).toEqual(groupedData);
        expect(result).toHaveLength(2);
      });

      it('should handle byDate with default format parameter', () => {
        // Test that byDate defaults to 'day' when no format specified
        const result = $group.byDate(testPosts, (post) => post.date);
        
        expect(result).toHaveLength(2);
        expect(result.find((g) => g.key === '2024-01-15')?.items).toHaveLength(2);
        expect(result.find((g) => g.key === '2024-01-16')?.items).toHaveLength(2);
      });

      it('should handle byProperty with non-existent property path', () => {
        const result = $group.byProperty(testUsers, 'nonExistent.property');
        
        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('undefined');
        expect(result[0].items).toHaveLength(3);
      });

      it('should handle byMultiple with three levels of grouping', () => {
        const result = $group.byMultiple(testPosts, [
          (post) => post.author.type,
          (post) => post.status,
          (post) => post.date.toISOString().split('T')[0],
        ]);

        expect(result).toHaveLength(2); // admin, user
        expect(result.every((group) => Array.isArray(group.items))).toBe(true);
        
        // Verify nested structure
        const adminGroup = result.find(g => g.key === 'admin');
        expect(adminGroup).toBeDefined();
        expect(Array.isArray(adminGroup?.items)).toBe(true);
      });

      it('should preserve options when using byDate with custom formatter', () => {
        const customFormatter = (date: Date) => `Custom-${date.getFullYear()}`;
        const result = $group.byDate(testPosts, (post) => post.date, customFormatter, {
          sortBy: 'key',
          sortOrder: 'desc'
        });

        expect(result).toHaveLength(1);
        expect(result[0].key).toBe('Custom-2024');
        expect(result[0].items).toHaveLength(4);
      });

      it('should handle byProperty with options', () => {
        const result = $group.byProperty(testUsers, 'role', {
          sortBy: 'count',
          sortOrder: 'desc'
        });

        expect(result).toHaveLength(2);
        expect(result[0].items).toHaveLength(2); // user (more items)
        expect(result[1].items).toHaveLength(1); // admin (fewer items)
      });
    });
  });
});
