import { TestEntityBuilder, TestEntity } from './entity.builder';

describe('Entity', () => {
  let entity: TestEntity;

  beforeEach(() => {
    entity = new TestEntityBuilder().build();
  });

  describe('constructor', () => {
    it('should create entity with generated ID when no ID provided', () => {
      const entity = new TestEntityBuilder().build();

      expect(entity.getId()).toBeDefined();
      expect(typeof entity.getId()).toBe('string');
      expect(entity.getId()).toBeTruthy();
    });

    it('should create entity with provided ID', () => {
      const customId = 'custom-id-123';
      const entity = new TestEntityBuilder().withId(customId).build();

      expect(entity.getId()).toBe(customId);
    });

    it('should initialize as not selected', () => {
      const entity = new TestEntityBuilder().build();

      expect(entity.selected).toBe(false);
    });
  });

  describe('selected getter', () => {
    it('should return false initially', () => {
      expect(entity.selected).toBe(false);
    });

    it('should return true after selection', () => {
      entity.select();

      expect(entity.selected).toBe(true);
    });

    it('should return false after unselection', () => {
      entity.select();
      entity.unselect();

      expect(entity.selected).toBe(false);
    });
  });

  describe('equal', () => {
    it('should return true when IDs match (string)', () => {
      const id = 'test-id';
      const entity = new TestEntityBuilder().withId(id).build();

      expect(entity.equal(id)).toBe(true);
    });

    it('should return true when IDs match (number)', () => {
      const entity = new TestEntityBuilder().build();
      entity.setId(123);

      expect(entity.equal(123)).toBe(true);
    });

    it('should return false when IDs do not match', () => {
      const entity = new TestEntityBuilder().withId('test-id').build();

      expect(entity.equal('different-id')).toBe(false);
    });

    it('should handle type coercion correctly', () => {
      const entity = new TestEntityBuilder().build();
      entity.setId('123');

      expect(entity.equal(123)).toBe(false); // Strict equality
    });
  });

  describe('select', () => {
    it('should set selected to true', () => {
      entity.select();

      expect(entity.selected).toBe(true);
    });

    it('should keep selected true if called multiple times', () => {
      entity.select();
      entity.select();

      expect(entity.selected).toBe(true);
    });
  });

  describe('unselect', () => {
    it('should set selected to false', () => {
      entity.select();
      entity.unselect();

      expect(entity.selected).toBe(false);
    });

    it('should keep selected false if called multiple times', () => {
      entity.unselect();
      entity.unselect();

      expect(entity.selected).toBe(false);
    });
  });

  describe('toggle', () => {
    it('should toggle from false to true', () => {
      expect(entity.selected).toBe(false);

      entity.toggle();

      expect(entity.selected).toBe(true);
    });

    it('should toggle from true to false', () => {
      entity.select();
      expect(entity.selected).toBe(true);

      entity.toggle();

      expect(entity.selected).toBe(false);
    });

    it('should toggle multiple times correctly', () => {
      entity.toggle(); // false -> true
      expect(entity.selected).toBe(true);

      entity.toggle(); // true -> false
      expect(entity.selected).toBe(false);

      entity.toggle(); // false -> true
      expect(entity.selected).toBe(true);
    });
  });

  describe('clone', () => {
    it('should create a deep copy of the entity', () => {
      const original = new TestEntityBuilder().build();
      original.select();

      const cloned = original.copy<TestEntity>();

      expect(cloned).not.toBe(original);
      expect(cloned.getId()).toBe(original.getId());
      expect(cloned.selected).toBe(original.selected);
      expect(cloned.name).toBe(original.name);
      expect(cloned.value).toBe(original.value);
    });

    it('should create independent copies', () => {
      const original = new TestEntityBuilder().build();
      const cloned = original.copy<TestEntity>();

      original.select();
      original.withName('modified');

      expect(cloned.selected).toBe(false);
      expect(cloned.name).toBe('test');
    });
  });

  describe('toPrimitives', () => {
    it('should return object with all primitive properties', () => {
      const entity = new TestEntityBuilder().withId('test-id').withName('Test Entity').withValue(100).build();
      entity.select();

      const primitives = entity.toPrimitives();

      expect(primitives).toEqual(
        expect.objectContaining({
          id: 'test-id',
          selected: true,
          name: 'Test Entity',
          value: 100,
        })
      );
    });

    it('should include generated ID in primitives', () => {
      const entity = new TestEntityBuilder().build();
      const primitives = entity.toPrimitives();

      expect(primitives['id']).toBe(entity.getId());
      expect(primitives.selected).toBe(false);
      expect(primitives.name).toBe('test');
      expect(primitives.value).toBe(0);
    });

    it('should reflect current selection state', () => {
      const entity = new TestEntityBuilder().build();

      let primitives = entity.toPrimitives();
      expect(primitives.selected).toBe(false);

      entity.select();
      primitives = entity.toPrimitives();
      expect(primitives.selected).toBe(true);
    });
  });

  describe('integration tests', () => {
    it('should support full entity lifecycle', () => {
      const entity = new TestEntityBuilder().withName('Lifecycle Test').withValue(50).build();

      // Initial state
      expect(entity.selected).toBe(false);
      expect(entity.name).toBe('Lifecycle Test');
      expect(entity.value).toBe(50);

      // Selection operations
      entity.select();
      expect(entity.selected).toBe(true);

      entity.toggle();
      expect(entity.selected).toBe(false);

      // ID operations
      const originalId = entity.getId();
      entity.setId('new-id');
      expect(entity.getId()).toBe('new-id');
      expect(entity.equal('new-id')).toBe(true);
      expect(entity.equal(originalId)).toBe(false);

      // Clone and verify independence
      const clone = entity.copy<TestEntity>();
      entity.select();
      expect(clone.selected).toBe(false);
    });
  });
});
