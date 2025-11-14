import { EntityList } from '../entity-list';
import { TestEntity } from './entity.builder';
import { TestEntityMother } from './entity.builder';

export class TestEntityList extends EntityList<TestEntity> {
  constructor(entities: TestEntity[] = []) {
    super(TestEntityList, entities);
  }
}

export class TestEntityListBuilder {
  private entities: TestEntity[] = [];

  public withEntities(entities: TestEntity[]): this {
    this.entities = entities;
    return this;
  }

  public withEntity(entity: TestEntity): this {
    this.entities.push(entity);
    return this;
  }

  public withDiverseEntities(): this {
    this.entities = TestEntityMother.diverse();
    return this;
  }

  public withSelectedEntities(): this {
    this.entities = [
      TestEntityMother.builder().withId('1').selected().build(),
      TestEntityMother.builder().withId('2').selected().build(),
    ];
    return this;
  }

  public withUnselectedEntities(): this {
    this.entities = [TestEntityMother.builder().withId('1').build(), TestEntityMother.builder().withId('2').build()];
    return this;
  }

  public build(): TestEntityList {
    return new TestEntityList(this.entities);
  }
}

export class TestEntityListMother {
  public static builder(): TestEntityListBuilder {
    return new TestEntityListBuilder();
  }

  public static empty(): TestEntityList {
    return this.builder().build();
  }

  public static withSingleEntity(): TestEntityList {
    return this.builder().withEntity(TestEntityMother.simple()).build();
  }

  public static withDiverseEntities(): TestEntityList {
    return this.builder().withDiverseEntities().build();
  }

  public static withSelectedEntities(): TestEntityList {
    return this.builder().withSelectedEntities().build();
  }

  public static withUnselectedEntities(): TestEntityList {
    return this.builder().withUnselectedEntities().build();
  }
}
