import { Filter, FiltersPrimitives } from './Filter';

export class Filters {
  constructor(public readonly value: Filter[]) {}

  static from(filters: FiltersPrimitives[]): Filters {
    return new Filters(filters.map((filter) => Filter.from(filter.field, filter.operator, filter.value)));
  }

  public toPrimitives(): FiltersPrimitives[] {
    return this.value.map((filter) => filter.toPrimitives());
  }

  public isEmpty(): boolean {
    return this.value.length === 0;
  }

  public hasFilters(): boolean {
    return !this.isEmpty();
  }
}
