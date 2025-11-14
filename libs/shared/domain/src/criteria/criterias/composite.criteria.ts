import { Criteria, Filters } from '../';

export class CompositeCriteria extends Criteria {
  private readonly criterias: Criteria[] = [];

  constructor(...criterias: Criteria[]) {
    super(new Filters(criterias.flatMap((c) => c.filters.value)));
    this.criterias = criterias;
  }

  public add(...criteria: Criteria[]): CompositeCriteria {
    return CompositeCriteria.from(...[...criteria, ...this.criterias]);
  }

  public static from(...criteria: Criteria[]) {
    return new CompositeCriteria(...criteria);
  }
}
