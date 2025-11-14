import { Entity } from '../entity';

export class TestEntity extends Entity {
  constructor(id?: string, public name = 'test', public value = 0) {
    super(id);
  }

  public withName(name: string): this {
    this.name = name;
    return this;
  }

  public withValue(value: number): this {
    this.value = value;
    return this;
  }

  public setId(id: string | number): this {
    return this.withId(id);
  }
}

export class TestEntityBuilder {
  private id?: string;
  private name = 'test';
  private value = 0;
  private isSelected = false;

  public withId(id: string): this {
    this.id = id;
    return this;
  }

  public withName(name: string): this {
    this.name = name;
    return this;
  }

  public withValue(value: number): this {
    this.value = value;
    return this;
  }

  public selected(): this {
    this.isSelected = true;
    return this;
  }

  public build(): TestEntity {
    const entity = new TestEntity(this.id, this.name, this.value);
    if (this.isSelected) {
      entity.select();
    }
    return entity;
  }
}

export class TestEntityMother {
  public static builder(): TestEntityBuilder {
    return new TestEntityBuilder();
  }

  public static simple(): TestEntity {
    return this.builder().build();
  }

  public static withId(id: string): TestEntity {
    return this.builder().withId(id).build();
  }

  public static withName(name: string): TestEntity {
    return this.builder().withName(name).build();
  }

  public static withValue(value: number): TestEntity {
    return this.builder().withValue(value).build();
  }

  public static selected(): TestEntity {
    return this.builder().selected().build();
  }

  public static diverse(): TestEntity[] {
    return [
      this.builder().withId('1').withName('First').withValue(10).build(),
      this.builder().withId('2').withName('Second').withValue(20).selected().build(),
      this.builder().withId('3').withName('Third').withValue(30).build(),
      this.builder().withId('4').withName('Fourth').withValue(40).selected().build(),
    ];
  }
}
