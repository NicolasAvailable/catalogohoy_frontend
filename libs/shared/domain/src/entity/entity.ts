import { IdFactory } from '../factory/id';
import { $object } from '../utilities/object/object';

export abstract class Entity {
  public readonly id!: number | string;
  public readonly selected = false;

  constructor(id?: string) {
    this.id = id ?? IdFactory.create();
  }

  public getId(): number | string {
    return this.id;
  }

  public equal(id: string | number): boolean {
    return this.id === id;
  }

  protected withId(id: string | number | undefined | null): this {
    (this.id as string | number) = id ?? IdFactory.create();
    return this;
  }

  public select(): void {
    (this.selected as boolean) = true;
  }

  public unselect(): void {
    (this.selected as boolean) = false;
  }

  public toggle(): void {
    (this.selected as boolean) = !this.selected;
  }

  public copy<T>(): T {
    return $object.action(this).clone() as unknown as T;
  }

  public toPrimitives(): this {
    return { ...this };
  }
}
