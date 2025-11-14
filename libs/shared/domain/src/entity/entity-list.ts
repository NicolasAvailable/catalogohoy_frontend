import { when } from '../either/either.builder';
import { Specification } from '../specification';
import { $object } from '../utilities/object/object';
import { Entity } from './entity';

type EntityListClass<T extends Entity> = new (...args: any[]) => EntityList<T>;

export abstract class EntityList<T extends Entity> {
  constructor(public readonly entityListClass: EntityListClass<T>, public readonly entities: T[]) {}

  public get items(): T[] {
    return this.entities;
  }

  public get ids() {
    return this.entities.map((entity) => entity.getId());
  }

  public get first() {
    return this.items[0];
  }

  public get last() {
    return this.items[this.items.length - 1];
  }

  public get isEmpty(): boolean {
    return this.entities.length === 0;
  }

  public get selected(): this {
    return new this.entityListClass(this.entities.filter((entity) => entity.selected)) as this;
  }

  public get length(): number {
    return this.entities.length;
  }

  public get uniques(): this {
    return this.filter((item, index) => this.items.findIndex((i) => i.getId() === item.getId()) === index);
  }

  public get has() {
    return {
      items: this.entities.length > 0,
      selected: {
        all: this.entities.every((entity) => entity.selected),
        none: this.entities.every((entity) => !entity.selected),
        some: this.entities.some((entity) => entity.selected),
      },
    };
  }

  public indexOf(entity: T): number {
    return this.entities.findIndex((e) => e.equal(entity.id));
  }

  public get mutable() {
    return {
      update: (entityList: EntityList<T>) => this.entities.splice(0, this.entities.length, ...entityList.entities),
      insert: (entity: T) => this.entities.push(entity),
      remove: (entity: T) => this.indexOf(entity) > -1 && this.entities.splice(this.indexOf(entity), 1),
      replace: (entity: T) => this.indexOf(entity) > -1 && this.entities.splice(this.indexOf(entity), 1, entity),
      merge: (entityList: EntityList<T>) => {
        this.entities.splice(0, this.entities.length, ...$object.action(this.entities).uniqueById(entityList.entities));
      },
    };
  }

  public get immutable() {
    return {
      update: (entityList: EntityList<T>) => this.copy(entityList.entities) as this,
      insert: (entity: T) => this.copy([...this.entities, entity]) as this,
      remove: (entity: T) => this.copy(this.entities.filter((e) => !e.equal(entity.id))) as this,
      replace: (entity: T) => this.copy(this.entities.map((e) => (e.equal(entity.id) ? entity : e))) as this,
      merge: (entityList: EntityList<T>) =>
        this.copy($object.action(this.entities).uniqueById(entityList.entities)) as this,
    };
  }

  public copy(entities: T[]) {
    return new this.entityListClass(entities.map((_) => _.copy()));
  }

  public find(id: number | string): T {
    return this.entities.find((entity) => entity.getId() === id) as T;
  }

  public filter(predicate: (entity: T, index: number) => boolean): this {
    return new this.entityListClass(this.entities.filter(predicate)) as this;
  }

  public map(predicate: (entity: T, index: number) => T): this {
    return new this.entityListClass(this.entities.map(predicate)) as this;
  }

  public some(predicate: (entity: T) => boolean): boolean {
    return this.entities.some(predicate);
  }

  public every(predicate: (entity: T) => boolean): boolean {
    return this.entities.every(predicate);
  }

  public apply(specification: Specification<T>): this {
    return new this.entityListClass(this.entities.filter((entity) => specification.isSatisfiedBy(entity))) as this;
  }

  public clear(): void {
    this.entities.splice(0, this.entities.length);
  }

  public get select() {
    return {
      all: () => this.entities.forEach((entity) => entity.select()),
      one: (entity: T) => this.find(entity.getId()).select(),
      many: (entities: T[]) => entities.forEach((entity) => entity.select()),
      simple: (entity: T) => {
        when(this.unselect.all()).mapRight(() => this.select.one(entity));
      },
    };
  }

  public get toggle() {
    return {
      all: () => this.entities.forEach((entity) => entity.toggle()),
      one: (entity: T) => this.find(entity.getId()).toggle(),
      many: (entities: T[]) => entities.forEach((entity) => entity.toggle()),
    };
  }

  public get unselect() {
    return {
      all: () => this.entities.forEach((entity) => entity.unselect()),
      one: (entity: T) => this.find(entity.getId()).unselect(),
      many: (entities: T[]) => entities.forEach((entity) => entity.unselect()),
    };
  }

  public toPrimitives(): T[] {
    return this.entities.map((entity) => entity.toPrimitives());
  }
}
