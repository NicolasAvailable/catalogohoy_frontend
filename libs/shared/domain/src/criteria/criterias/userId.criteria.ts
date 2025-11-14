import { Criteria, Filters, Operator } from '../';

export class UserIdCriteria extends Criteria {
  constructor(userId: string, operator = Operator.EQUAL) {
    super(Filters.from([{ field: 'userId', operator, value: userId }]));
  }

  public static eq(userId: string) {
    return new UserIdCriteria(userId, Operator.EQUAL);
  }

  public static not(userId: string) {
    return new UserIdCriteria(userId, Operator.NOT_EQUAL);
  }
}
