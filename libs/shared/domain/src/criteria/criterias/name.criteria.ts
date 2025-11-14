import { Criteria, Filters, Operator } from '../';

export class NameCriteria extends Criteria {
  constructor(name: string, operator = Operator.EQUAL) {
    super(Filters.from([{ field: 'name', operator, value: name }]));
  }

  public static eq(name: string) {
    return new NameCriteria(name, Operator.EQUAL);
  }

  public static not(name: string) {
    return new NameCriteria(name, Operator.NOT_EQUAL);
  }
}
