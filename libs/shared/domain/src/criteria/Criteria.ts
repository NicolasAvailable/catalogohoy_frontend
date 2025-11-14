import { Filters } from './Filters';

export class Criteria {
  public readonly filters: Filters;

  constructor(filters: Filters = new Filters([])) {
    this.filters = filters;
  }

  public hasFilters(): boolean {
    return this.filters.hasFilters();
  }
}
