import { Criteria, Filters, Operator } from '../';

export class IdCriteria extends Criteria {
  constructor(userId: string, operator = Operator.EQUAL) {
    super(Filters.from([{ field: 'id', operator, value: userId }]));
  }

  public static eq(id: string) {
    return new IdCriteria(id, Operator.EQUAL);
  }

  public static not(id: string) {
    return new IdCriteria(id, Operator.NOT_EQUAL);
  }
}
