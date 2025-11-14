import { Criteria, Filters, Operator } from '../';

export class EmailCriteria extends Criteria {
  constructor(email: string, operator = Operator.EQUAL) {
    super(Filters.from([{ field: 'email', operator, value: email }]));
  }

  public static eq(email: string) {
    return new EmailCriteria(email, Operator.EQUAL);
  }

  public static not(email: string) {
    return new EmailCriteria(email, Operator.NOT_EQUAL);
  }
}
