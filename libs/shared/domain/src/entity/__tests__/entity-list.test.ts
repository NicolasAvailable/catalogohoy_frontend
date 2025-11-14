import { Specification } from '../../specification';
import { TestEntity, TestEntityMother } from './entity.builder';
import { TestEntityList, TestEntityListMother } from './entity-list.builder';

class ValueGreaterThanSpecification extends Specification<TestEntity> {
  constructor(private threshold: number) {
    super();
  }

  public isSatisfiedBy(entity: TestEntity): boolean {
    return entity.value > this.threshold;
  }
}

class SelectedSpecification extends Specification<TestEntity> {
  public isSatisfiedBy(entity: TestEntity): boolean {
    return entity.selected;
  }
}

describe('EntityList', () => {
  let entityList: TestEntityList;

  beforeEach(() => {
    entityList = TestEntityListMother.withDiverseEntities();
  });

  describe('constructor', () => {
    it('should create empty list', () => {
      const emptyList = TestEntityListMother.empty();

      expect(emptyList.entities).toEqual([]);
      expect(emptyList.length).toBe(0);
    });

    it('should create list with provided entities', () => {
      const entities = TestEntityMother.diverse();
      const list = TestEntityListMother.builder().withEntities(entities).build();

      expect(list.entities).toBe(entities);
      expect(list.length).toBe(entities.length);
    });
  });

  describe('items getter', () => {
    it('should return the entities array', () => {
      const entities = TestEntityMother.diverse();
      const list = TestEntityListMother.builder().withEntities(entities).build();

      expect(list.items).toBe(entities);
    });
  });

  describe('ids getter', () => {
    it('should return array of entity IDs', () => {
      const ids = entityList.ids;

      expect(ids).toEqual(['1', '2', '3', '4']);
      expect(ids).toHaveLength(entityList.length);
    });

    it('should return empty array for empty list', () => {
      const emptyList = TestEntityListMother.empty();
      const ids = emptyList.ids;

      expect(ids).toEqual([]);
      expect(ids).toHaveLength(0);
    });

    it('should handle mixed ID types', () => {
      const entity1 = TestEntityMother.builder().withId('string-id').build();
      const entity2 = TestEntityMother.simple();
      entity2.setId(123); // Set numeric ID after creation
      const list = TestEntityListMother.builder().withEntities([entity1, entity2]).build();

      const ids = list.ids;

      expect(ids).toEqual(['string-id', 123]);
      expect(ids).toHaveLength(2);
    });
  });

  describe('first getter', () => {
    it('should return the first entity in the list', () => {
      const firstEntity = entityList.first;

      expect(firstEntity).toBeDefined();
      expect(firstEntity.getId()).toBe('1');
      expect(firstEntity.name).toBe('First');
    });

    it('should return undefined for empty list', () => {
      const emptyList = TestEntityListMother.empty();
      const firstEntity = emptyList.first;

      expect(firstEntity).toBeUndefined();
    });
  });

  describe('isEmpty getter', () => {
    it('should return true for empty list', () => {
      const emptyList = TestEntityListMother.empty();

      expect(emptyList.isEmpty).toBe(true);
    });

    it('should return false for non-empty list', () => {
      expect(entityList.isEmpty).toBe(false);
    });
  });

  describe('selected getter', () => {
    it('should return new list with only selected entities', () => {
      const selectedList = entityList.selected;

      expect(selectedList).toBeInstanceOf(TestEntityList);
      expect(selectedList).not.toBe(entityList);
      expect(selectedList.entities.every((e) => e.selected)).toBe(true);
      expect(selectedList.length).toBe(2); // From diverse entities, 2 are selected
    });

    it('should return empty list when no entities are selected', () => {
      const unselectedList = TestEntityListMother.withUnselectedEntities();
      const selectedList = unselectedList.selected;

      expect(selectedList.isEmpty).toBe(true);
    });
  });

  describe('length getter', () => {
    it('should return number of entities', () => {
      expect(entityList.length).toBe(4);
    });

    it('should return 0 for empty list', () => {
      const emptyList = TestEntityListMother.empty();

      expect(emptyList.length).toBe(0);
    });
  });

  describe('uniques getter', () => {
    it('should return new list with unique entities by ID', () => {
      // Create list with duplicate entities (same ID)
      const entity1 = TestEntityMother.builder().withId('1').withName('Entity 1').build();
      const entity2 = TestEntityMother.builder().withId('2').withName('Entity 2').build();
      const entity1Duplicate = TestEntityMother.builder().withId('1').withName('Entity 1 Duplicate').build();
      const entity3 = TestEntityMother.builder().withId('3').withName('Entity 3').build();

      const listWithDuplicates = TestEntityListMother.builder()
        .withEntities([entity1, entity2, entity1Duplicate, entity3])
        .build();

      const uniqueList = listWithDuplicates.uniques;

      expect(uniqueList).toBeInstanceOf(TestEntityList);
      expect(uniqueList).not.toBe(listWithDuplicates);
      expect(uniqueList.length).toBe(3); // Should have 3 unique entities
      expect(uniqueList.entities[0]).toBe(entity1); // First occurrence kept
      expect(uniqueList.entities[1]).toBe(entity2);
      expect(uniqueList.entities[2]).toBe(entity3);
      expect(uniqueList.entities).not.toContain(entity1Duplicate);
    });
  });

  describe('has getter', () => {
    describe('items', () => {
      it('should return true when list has items', () => {
        expect(entityList.has.items).toBe(true);
      });

      it('should return false when list is empty', () => {
        const emptyList = TestEntityListMother.empty();

        expect(emptyList.has.items).toBe(false);
      });
    });

    describe('selected', () => {
      it('should return correct selection states for diverse list', () => {
        const has = entityList.has.selected;

        expect(has.all).toBe(false); // Not all are selected
        expect(has.none).toBe(false); // Not none are selected
        expect(has.some).toBe(true); // Some are selected
      });

      it('should return correct states when all are selected', () => {
        const allSelectedList = TestEntityListMother.withSelectedEntities();
        const has = allSelectedList.has.selected;

        expect(has.all).toBe(true);
        expect(has.none).toBe(false);
        expect(has.some).toBe(true);
      });

      it('should return correct states when none are selected', () => {
        const noneSelectedList = TestEntityListMother.withUnselectedEntities();
        const has = noneSelectedList.has.selected;

        expect(has.all).toBe(false);
        expect(has.none).toBe(true);
        expect(has.some).toBe(false);
      });

      it('should handle empty list correctly', () => {
        const emptyList = TestEntityListMother.empty();
        const has = emptyList.has.selected;

        expect(has.all).toBe(true); // Vacuous truth
        expect(has.none).toBe(true); // Vacuous truth
        expect(has.some).toBe(false);
      });
    });
  });

  describe('mutable operations', () => {
    describe('update', () => {
      it('should replace all entities with new entity list', () => {
        const newEntities = [
          TestEntityMother.builder().withId('new1').withName('New Entity 1').build(),
          TestEntityMother.builder().withId('new2').withName('New Entity 2').build(),
        ];
        const newList = TestEntityListMother.builder().withEntities(newEntities).build();
        const originalLength = entityList.length;

        entityList.mutable.update(newList);

        expect(entityList.length).toBe(2);
        expect(entityList.length).not.toBe(originalLength);
        expect(entityList.entities[0].getId()).toBe('new1');
        expect(entityList.entities[1].getId()).toBe('new2');
        expect(entityList.entities[0].name).toBe('New Entity 1');
        expect(entityList.entities[1].name).toBe('New Entity 2');
      });

      it('should preserve entity properties when updating', () => {
        const selectedEntity = TestEntityMother.builder().withId('selected').withName('Selected').build();
        selectedEntity.select();
        const newList = TestEntityListMother.builder().withEntities([selectedEntity]).build();

        entityList.mutable.update(newList);

        expect(entityList.length).toBe(1);
        expect(entityList.entities[0].selected).toBe(true);
        expect(entityList.entities[0].name).toBe('Selected');
      });
    });

    describe('insert', () => {
      it('should add entity to existing array', () => {
        const newEntity = TestEntityMother.withName('New Entity');
        const originalLength = entityList.length;

        entityList.mutable.insert(newEntity);

        expect(entityList.length).toBe(originalLength + 1);
        expect(entityList.entities).toContain(newEntity);
      });
    });

    describe('remove', () => {
      it('should remove entity from existing array', () => {
        const entityToRemove = entityList.entities[0];
        const originalLength = entityList.length;

        entityList.mutable.remove(entityToRemove);

        expect(entityList.length).toBe(originalLength - 1);
        expect(entityList.entities).not.toContain(entityToRemove);
      });

      it('should handle removing non-existent entity gracefully', () => {
        const nonExistentEntity = TestEntityMother.withName('Non-existent');
        const originalLength = entityList.length;

        entityList.mutable.remove(nonExistentEntity);

        expect(entityList.length).toBe(originalLength);
      });
    });

    describe('replace', () => {
      it('should replace existing entity with new entity', () => {
        const originalEntity = entityList.entities[1]; // Second entity with ID '2'
        const replacementEntity = TestEntityMother.builder()
          .withId('2')
          .withName('Replaced Entity')
          .withValue(999)
          .build();
        const originalLength = entityList.length;

        entityList.mutable.replace(replacementEntity);

        expect(entityList.length).toBe(originalLength);
        expect(entityList.entities[1]).toBe(replacementEntity);
        expect(entityList.entities[1].name).toBe('Replaced Entity');
        expect(entityList.entities[1].value).toBe(999);
        expect(entityList.entities).not.toContain(originalEntity);
      });

      it('should handle replacing non-existent entity gracefully', () => {
        const nonExistentEntity = TestEntityMother.builder().withId('non-existent').withName('Non-existent').build();
        const originalLength = entityList.length;
        const originalEntities = [...entityList.entities];

        entityList.mutable.replace(nonExistentEntity);

        expect(entityList.length).toBe(originalLength);
        expect(entityList.entities).toEqual(originalEntities);
      });
    });

    describe('merge', () => {
      it('should merge entities with unique IDs only', () => {
        const list1 = TestEntityListMother.builder()
          .withEntities([
            TestEntityMother.builder().withId('1').withName('Entity 1').build(),
            TestEntityMother.builder().withId('2').withName('Entity 2').build(),
          ])
          .build();

        const list2 = TestEntityListMother.builder()
          .withEntities([
            TestEntityMother.builder().withId('3').withName('Entity 3').build(),
            TestEntityMother.builder().withId('4').withName('Entity 4').build(),
          ])
          .build();

        const originalLength = list1.length;

        list1.mutable.merge(list2);

        expect(list1.length).toBe(originalLength + 2);
        expect(list1.entities.some((e) => e.getId() === '3')).toBe(true);
        expect(list1.entities.some((e) => e.getId() === '4')).toBe(true);
      });

      it('should not add duplicate entities by ID', () => {
        const list1 = TestEntityListMother.builder()
          .withEntities([
            TestEntityMother.builder().withId('1').withName('Entity 1').build(),
            TestEntityMother.builder().withId('2').withName('Entity 2').build(),
          ])
          .build();

        const list2 = TestEntityListMother.builder()
          .withEntities([
            TestEntityMother.builder().withId('2').withName('Entity 2 Duplicate').build(),
            TestEntityMother.builder().withId('3').withName('Entity 3').build(),
          ])
          .build();

        const originalLength = list1.length;

        list1.mutable.merge(list2);

        expect(list1.length).toBe(originalLength + 1); // Only Entity 3 should be added
        expect(list1.entities.filter((e) => e.getId() === '2')).toHaveLength(1);
        expect(list1.entities.some((e) => e.getId() === '3')).toBe(true);
      });
    });
  });

  describe('immutable operations', () => {
    describe('update', () => {
      it('should return new list with updated entities', () => {
        const newEntities = [
          TestEntityMother.builder().withId('new1').withName('New Entity 1').build(),
          TestEntityMother.builder().withId('new2').withName('New Entity 2').build(),
        ];
        const newList = TestEntityListMother.builder().withEntities(newEntities).build();
        const originalLength = entityList.length;

        const updatedList = entityList.immutable.update(newList);

        expect(updatedList).toBeInstanceOf(TestEntityList);
        expect(updatedList).not.toBe(entityList);
        expect(updatedList).not.toBe(newList);
        expect(updatedList.length).toBe(2);
        expect(updatedList.entities[0].getId()).toBe('new1');
        expect(updatedList.entities[1].getId()).toBe('new2');
        expect(updatedList.entities[0].name).toBe('New Entity 1');
        expect(updatedList.entities[1].name).toBe('New Entity 2');

        // Original list should remain unchanged
        expect(entityList.length).toBe(originalLength);
        expect(entityList.entities[0].getId()).toBe('1');
      });

      it('should preserve entity properties in updated list', () => {
        const selectedEntity = TestEntityMother.builder().withId('selected').withName('Selected').build();
        selectedEntity.select();
        const newList = TestEntityListMother.builder().withEntities([selectedEntity]).build();

        const updatedList = entityList.immutable.update(newList);

        expect(updatedList.length).toBe(1);
        expect(updatedList.entities[0].selected).toBe(true);
        expect(updatedList.entities[0].name).toBe('Selected');
        expect(updatedList.entities[0].getId()).toBe('selected');

        // Original list should remain unchanged
        expect(entityList.length).toBe(4);
        expect(entityList.entities[0].selected).toBe(false);
      });

      it('should create completely independent list', () => {
        const entity1 = TestEntityMother.builder().withId('independent').withName('Independent').build();
        const sourceList = TestEntityListMother.builder().withEntities([entity1]).build();

        const updatedList = entityList.immutable.update(sourceList);

        // Modify the entity in the updated list
        updatedList.entities[0].select();

        expect(entity1.selected).toBe(false); // not same reference
        expect(sourceList.entities[0].selected).toBe(false); // not same reference
        expect(updatedList.entities[0].selected).toBe(true); // same reference

        // But original entityList should be unaffected
        expect(entityList.entities.every((e) => !e.selected || e.getId() === '2' || e.getId() === '4')).toBe(true);
      });
    });

    describe('insert', () => {
      it('should return new list with added entity', () => {
        const newEntity = TestEntityMother.withName('New Entity');
        const newList = entityList.immutable.insert(newEntity);

        expect(newList).toBeInstanceOf(TestEntityList);
        expect(newList).not.toBe(entityList);
        expect(newList.length).toBe(entityList.length + 1);
        expect(newList.entities).toContainEqual(newEntity);
        expect(entityList.entities).not.toContainEqual(newEntity);
      });
    });

    describe('remove', () => {
      it('should return new list without removed entity', () => {
        const entityToRemove = entityList.entities[0];
        const newList = entityList.immutable.remove(entityToRemove);

        expect(newList).toBeInstanceOf(TestEntityList);
        expect(newList).not.toBe(entityList);
        expect(newList.length).toBe(entityList.length - 1);
        expect(newList.entities).not.toContain(entityToRemove);
        expect(entityList.entities).toContain(entityToRemove);
      });

      it('should handle removing non-existent entity', () => {
        const nonExistentEntity = TestEntityMother.withName('Non-existent');
        const newList = entityList.immutable.remove(nonExistentEntity);

        expect(newList.length).toBe(entityList.length);
      });
    });

    describe('replace', () => {
      it('should return new list with replaced entity', () => {
        const originalEntity = entityList.entities[1]; // Second entity with ID '2'
        const replacementEntity = TestEntityMother.builder()
          .withId('2')
          .withName('Replaced Entity')
          .withValue(999)
          .build();

        const newList = entityList.immutable.replace(replacementEntity);

        expect(newList).toBeInstanceOf(TestEntityList);
        expect(newList).not.toBe(entityList);
        expect(newList.length).toBe(entityList.length);
        expect(newList.entities[1]).not.toBe(originalEntity);
        expect(newList.entities[1].name).toBe('Replaced Entity');
        expect(newList.entities[1].value).toBe(999);
        expect(newList.entities[1].getId()).toBe('2');

        // Original list should remain unchanged
        expect(entityList.entities[1]).toBe(originalEntity);
        expect(entityList.entities[1].name).toBe('Second');
      });

      it('should return new list with same entities when replacing non-existent entity', () => {
        const nonExistentEntity = TestEntityMother.builder().withId('non-existent').withName('Non-existent').build();

        const newList = entityList.immutable.replace(nonExistentEntity);

        expect(newList).toBeInstanceOf(TestEntityList);
        expect(newList).not.toBe(entityList);
        expect(newList.length).toBe(entityList.length);
        expect(newList.entities.map((e) => e.getId())).toEqual(entityList.entities.map((e) => e.getId()));
      });

      it('should create independent entities in replaced list', () => {
        const replacementEntity = TestEntityMother.builder().withId('1').withName('Independent').build();

        const newList = entityList.immutable.replace(replacementEntity);

        // Modify the entity in the new list
        newList.entities[0].select();

        // Original list should be unaffected
        expect(entityList.entities[0].selected).toBe(false);
        expect(newList.entities[0].selected).toBe(true);
      });
    });

    describe('merge', () => {
      it('should return new list with unique entities merged', () => {
        const list1 = TestEntityListMother.builder()
          .withEntities([
            TestEntityMother.builder().withId('1').withName('Entity 1').build(),
            TestEntityMother.builder().withId('2').withName('Entity 2').build(),
          ])
          .build();

        const list2 = TestEntityListMother.builder()
          .withEntities([
            TestEntityMother.builder().withId('3').withName('Entity 3').build(),
            TestEntityMother.builder().withId('4').withName('Entity 4').build(),
          ])
          .build();

        const mergedList = list1.immutable.merge(list2);

        expect(mergedList).toBeInstanceOf(TestEntityList);
        expect(mergedList).not.toBe(list1);
        expect(mergedList).not.toBe(list2);
        expect(mergedList.length).toBe(4);
        expect(mergedList.entities.some((e) => e.getId() === '1')).toBe(true);
        expect(mergedList.entities.some((e) => e.getId() === '2')).toBe(true);
        expect(mergedList.entities.some((e) => e.getId() === '3')).toBe(true);
        expect(mergedList.entities.some((e) => e.getId() === '4')).toBe(true);

        // Original lists should remain unchanged
        expect(list1.length).toBe(2);
        expect(list2.length).toBe(2);
      });

      it('should not include duplicate entities by ID in merged list', () => {
        const list1 = TestEntityListMother.builder()
          .withEntities([
            TestEntityMother.builder().withId('1').withName('Entity 1').build(),
            TestEntityMother.builder().withId('2').withName('Entity 2').build(),
          ])
          .build();

        const list2 = TestEntityListMother.builder()
          .withEntities([
            TestEntityMother.builder().withId('2').withName('Entity 2 Duplicate').build(),
            TestEntityMother.builder().withId('3').withName('Entity 3').build(),
          ])
          .build();

        const mergedList = list1.immutable.merge(list2);

        expect(mergedList.length).toBe(3); // Should have unique entities only
        expect(mergedList.entities.filter((e) => e.getId() === '2')).toHaveLength(1);
        expect(mergedList.entities.some((e) => e.getId() === '1')).toBe(true);
        expect(mergedList.entities.some((e) => e.getId() === '3')).toBe(true);
      });

      it('should preserve entity properties in merged list', () => {
        const selectedEntity = TestEntityMother.builder().withId('selected').withName('Selected').build();
        selectedEntity.select();

        const list1 = TestEntityListMother.builder().withEntities([selectedEntity]).build();

        const list2 = TestEntityListMother.builder()
          .withEntities([TestEntityMother.builder().withId('unselected').withName('Unselected').build()])
          .build();

        const mergedList = list1.immutable.merge(list2);

        expect(mergedList.entities.find((e) => e.getId() === 'selected')?.selected).toBe(true);
        expect(mergedList.entities.find((e) => e.getId() === 'unselected')?.selected).toBe(false);
      });
    });
  });

  describe('indexOf', () => {
    it('should return correct index for existing entity', () => {
      const entityToFind = entityList.entities[1]; // Second entity
      const index = entityList.indexOf(entityToFind);

      expect(index).toBe(1);
    });

    it('should return -1 for non-existent entity', () => {
      const nonExistentEntity = TestEntityMother.withName('Non-existent');
      const index = entityList.indexOf(nonExistentEntity);

      expect(index).toBe(-1);
    });

    it('should find entity with same ID but different reference', () => {
      const entityWithSameId = TestEntityMother.builder().withId('2').withName('Different Name').build();
      const index = entityList.indexOf(entityWithSameId);

      expect(index).toBe(1); // Should find the entity with ID '2'
    });
  });

  describe('find', () => {
    it('should find entity by string ID', () => {
      const entity = entityList.find('2');

      expect(entity).toBeDefined();
      expect(entity.getId()).toBe('2');
      expect(entity.name).toBe('Second');
    });

    it('should find entity by numeric ID', () => {
      const numericEntity = TestEntityMother.simple();
      numericEntity.setId(123);
      const list = TestEntityListMother.builder().withEntity(numericEntity).build();

      const found = list.find(123);

      expect(found).toBe(numericEntity);
    });

    it('should return undefined for non-existent ID', () => {
      const entity = entityList.find('non-existent');

      expect(entity).toBeUndefined();
    });
  });

  describe('filter', () => {
    it('should return new list with filtered entities', () => {
      const filteredList = entityList.filter((entity) => entity.value > 20);

      expect(filteredList).toBeInstanceOf(TestEntityList);
      expect(filteredList).not.toBe(entityList);
      expect(filteredList.length).toBe(2); // Third and Fourth have values > 20
      expect(filteredList.entities.every((e) => e.value > 20)).toBe(true);
    });

    it('should return empty list when no entities match', () => {
      const filteredList = entityList.filter((entity) => entity.value > 100);

      expect(filteredList.isEmpty).toBe(true);
    });

    it('should provide index parameter to predicate', () => {
      const indices: number[] = [];
      entityList.filter((entity, index) => {
        indices.push(index);
        return true;
      });

      expect(indices).toEqual([0, 1, 2, 3]);
    });
  });

  describe('map', () => {
    it('should return new list with transformed entities', () => {
      const mappedList = entityList.map((entity) => {
        const newEntity = entity.copy<TestEntity>();
        newEntity.withValue(entity.value * 2);
        return newEntity;
      });

      expect(mappedList).toBeInstanceOf(TestEntityList);
      expect(mappedList).not.toBe(entityList);
      expect(mappedList.length).toBe(entityList.length);
      expect(mappedList.entities[0].value).toBe(20); // 10 * 2
      expect(mappedList.entities[1].value).toBe(40); // 20 * 2
      expect(mappedList.entities[2].value).toBe(60); // 30 * 2
      expect(mappedList.entities[3].value).toBe(80); // 40 * 2
    });

    it('should not modify original list', () => {
      const originalValues = entityList.entities.map((e) => e.value);

      entityList.map((entity) => {
        const newEntity = entity.copy<TestEntity>();
        newEntity.withValue(999);
        return newEntity;
      });

      expect(entityList.entities.map((e) => e.value)).toEqual(originalValues);
    });

    it('should provide index parameter to predicate', () => {
      const indices: number[] = [];
      entityList.map((entity, index) => {
        indices.push(index);
        return entity;
      });

      expect(indices).toEqual([0, 1, 2, 3]);
    });

    it('should allow modifying entity properties', () => {
      const mappedList = entityList.map((entity) => {
        const newEntity = entity.copy<TestEntity>();
        newEntity.withName(`Modified ${entity.name}`);
        return newEntity;
      });

      expect(mappedList.entities[0].name).toBe('Modified First');
      expect(mappedList.entities[1].name).toBe('Modified Second');
      expect(mappedList.entities[2].name).toBe('Modified Third');
      expect(mappedList.entities[3].name).toBe('Modified Fourth');
    });

    it('should allow selecting entities based on condition', () => {
      const mappedList = entityList.map((entity) => {
        const newEntity = entity.copy<TestEntity>();
        if (entity.value > 20) {
          newEntity.select();
        }
        return newEntity;
      });

      expect(mappedList.entities[0].selected).toBe(false); // value 10
      expect(mappedList.entities[1].selected).toBe(false); // value 20
      expect(mappedList.entities[2].selected).toBe(true); // value 30
      expect(mappedList.entities[3].selected).toBe(true); // value 40
    });

    it('should work with empty list', () => {
      const emptyList = TestEntityListMother.empty();
      const mappedList = emptyList.map((entity) => {
        const newEntity = entity.copy<TestEntity>();
        newEntity.withValue(999);
        return newEntity;
      });

      expect(mappedList.isEmpty).toBe(true);
      expect(mappedList.length).toBe(0);
    });

    it('should preserve entity IDs', () => {
      const mappedList = entityList.map((entity) => {
        const newEntity = entity.copy<TestEntity>();
        newEntity.withValue(entity.value + 100);
        return newEntity;
      });

      expect(mappedList.entities.map((e) => e.getId())).toEqual(entityList.entities.map((e) => e.getId()));
    });

    it('should create new entity instances', () => {
      const mappedList = entityList.map((entity) => entity.copy<TestEntity>());

      entityList.entities.forEach((originalEntity, index) => {
        expect(mappedList.entities[index]).not.toBe(originalEntity);
        expect(mappedList.entities[index].getId()).toBe(originalEntity.getId());
      });
    });
  });

  describe('some', () => {
    it('should return true when some entities match predicate', () => {
      const result = entityList.some((entity) => entity.selected);

      expect(result).toBe(true);
    });

    it('should return false when no entities match predicate', () => {
      const result = entityList.some((entity) => entity.value > 100);

      expect(result).toBe(false);
    });
  });

  describe('every', () => {
    it('should return true when all entities match predicate', () => {
      const result = entityList.every((entity) => entity.value > 0);

      expect(result).toBe(true);
    });

    it('should return false when not all entities match predicate', () => {
      const result = entityList.every((entity) => entity.selected);

      expect(result).toBe(false);
    });
  });

  describe('apply (specification pattern)', () => {
    it('should filter entities using specification', () => {
      const spec = new ValueGreaterThanSpecification(20);
      const filteredList = entityList.apply(spec);

      expect(filteredList).toBeInstanceOf(TestEntityList);
      expect(filteredList.length).toBe(2);
      expect(filteredList.entities.every((e) => e.value > 20)).toBe(true);
    });

    it('should work with selected specification', () => {
      const spec = new SelectedSpecification();
      const filteredList = entityList.apply(spec);

      expect(filteredList.length).toBe(2);
      expect(filteredList.entities.every((e) => e.selected)).toBe(true);
    });

    it('should work with combined specifications', () => {
      const valueSpec = new ValueGreaterThanSpecification(15);
      const selectedSpec = new SelectedSpecification();
      const combinedSpec = valueSpec.and(selectedSpec);

      const filteredList = entityList.apply(combinedSpec);

      expect(filteredList.length).toBe(2); // Only Fourth (value 40, selected)
    });
  });

  describe('select operations', () => {
    describe('all', () => {
      it('should select all entities', () => {
        entityList.select.all();

        expect(entityList.entities.every((e) => e.selected)).toBe(true);
      });
    });

    describe('one', () => {
      it('should select specific entity', () => {
        const entityToSelect = entityList.entities[0];
        entityToSelect.unselect(); // Ensure it starts unselected

        entityList.select.one(entityToSelect);

        expect(entityToSelect.selected).toBe(true);
      });
    });

    describe('many', () => {
      it('should select multiple entities', () => {
        const entitiesToSelect = [entityList.entities[0], entityList.entities[2]];
        entitiesToSelect.forEach((e) => e.unselect());

        entityList.select.many(entitiesToSelect);

        expect(entitiesToSelect.every((e) => e.selected)).toBe(true);
      });
    });

    describe('simple', () => {
      it('should unselect all and then select only the specified entity', () => {
        // Given a diverse list where some entities are already selected (IDs '2' and '4')
        expect(entityList.entities.map((e) => e.selected)).toEqual([false, true, false, true]);

        const target = entityList.entities[0]; // currently unselected

        // When calling select.simple with the target entity
        entityList.select.simple(target);

        // Then only the target should be selected and others unselected
        expect(target.selected).toBe(true);
        entityList.entities.forEach((e, idx) => {
          if (idx !== 0) {
            expect(e.selected).toBe(false);
          }
        });
      });
    });
  });

  describe('toggle operations', () => {
    describe('all', () => {
      it('should toggle all entities', () => {
        const originalStates = entityList.entities.map((e) => e.selected);

        entityList.toggle.all();

        entityList.entities.forEach((entity, index) => {
          expect(entity.selected).toBe(!originalStates[index]);
        });
      });
    });

    describe('one', () => {
      it('should toggle specific entity', () => {
        const entityToToggle = entityList.entities[0];
        const originalState = entityToToggle.selected;

        entityList.toggle.one(entityToToggle);

        expect(entityToToggle.selected).toBe(!originalState);
      });
    });

    describe('many', () => {
      it('should toggle multiple entities', () => {
        const entitiesToToggle = [entityList.entities[0], entityList.entities[2]];
        const originalStates = entitiesToToggle.map((e) => e.selected);

        entityList.toggle.many(entitiesToToggle);

        entitiesToToggle.forEach((entity, index) => {
          expect(entity.selected).toBe(!originalStates[index]);
        });
      });
    });
  });

  describe('unselect operations', () => {
    describe('all', () => {
      it('should unselect all entities', () => {
        entityList.select.all(); // First select all

        entityList.unselect.all();

        expect(entityList.entities.every((e) => !e.selected)).toBe(true);
      });
    });

    describe('one', () => {
      it('should unselect specific entity', () => {
        const entityToUnselect = entityList.entities[1]; // This one is selected
        expect(entityToUnselect.selected).toBe(true);

        entityList.unselect.one(entityToUnselect);

        expect(entityToUnselect.selected).toBe(false);
      });
    });

    describe('many', () => {
      it('should unselect multiple entities', () => {
        const entitiesToUnselect = [entityList.entities[1], entityList.entities[3]]; // These are selected
        expect(entitiesToUnselect.every((e) => e.selected)).toBe(true);

        entityList.unselect.many(entitiesToUnselect);

        expect(entitiesToUnselect.every((e) => !e.selected)).toBe(true);
      });
    });
  });

  describe('copy', () => {
    it('should create new list with copied entities', () => {
      const entities = [
        TestEntityMother.builder().withId('copy1').withName('Copy 1').build(),
        TestEntityMother.builder().withId('copy2').withName('Copy 2').build(),
      ];
      const copiedList = entityList.copy(entities);

      expect(copiedList).toBeInstanceOf(TestEntityList);
      expect(copiedList).not.toBe(entityList);
      expect(copiedList.length).toBe(2);
      expect(copiedList.entities[0].getId()).toBe('copy1');
      expect(copiedList.entities[1].getId()).toBe('copy2');
    });

    it('should create independent copies of entities', () => {
      const originalEntity = TestEntityMother.builder().withId('original').withName('Original').build();
      const copiedList = entityList.copy([originalEntity]);

      // Modify the copied entity
      copiedList.entities[0].select();
      copiedList.entities[0].withName('Modified');

      // Original entity should remain unchanged
      expect(originalEntity.selected).toBe(false);
      expect(originalEntity.name).toBe('Original');
      expect(copiedList.entities[0].selected).toBe(true);
      expect(copiedList.entities[0].name).toBe('Modified');
    });

    it('should handle empty entities array', () => {
      const copiedList = entityList.copy([]);

      expect(copiedList).toBeInstanceOf(TestEntityList);
      expect(copiedList.isEmpty).toBe(true);
      expect(copiedList.length).toBe(0);
    });
  });

  describe('toPrimitives', () => {
    it('should return array of primitive objects', () => {
      const primitives = entityList.toPrimitives();

      expect(primitives).toHaveLength(entityList.length);
      expect(primitives[0]).toEqual(
        expect.objectContaining({
          id: '1',
          selected: false,
          name: 'First',
          value: 10,
        })
      );
      expect(primitives[1]).toEqual(
        expect.objectContaining({
          id: '2',
          selected: true,
          name: 'Second',
          value: 20,
        })
      );
    });

    it('should return empty array for empty list', () => {
      const emptyList = TestEntityListMother.empty();
      const primitives = emptyList.toPrimitives();

      expect(primitives).toEqual([]);
    });
  });

  describe('integration tests', () => {
    it('should maintain immutability correctly', () => {
      const original = TestEntityListMother.withDiverseEntities();
      const originalLength = original.length;
      const originalFirstEntity = original.entities[0];

      // Immutable operations should not affect original
      const withNewEntity = original.immutable.insert(TestEntityMother.withName('New'));
      const withoutFirstEntity = original.immutable.remove(originalFirstEntity);
      const filtered = original.filter((e) => e.value > 15);
      const specified = original.apply(new SelectedSpecification());

      // Original should be unchanged
      expect(original.length).toBe(originalLength);
      expect(original.entities[0]).toBe(originalFirstEntity);

      // New lists should be different
      expect(withNewEntity.length).toBe(originalLength + 1);
      expect(withoutFirstEntity.length).toBe(originalLength - 1);
      expect(filtered).not.toBe(original);
      expect(specified).not.toBe(original);
    });
  });
});
