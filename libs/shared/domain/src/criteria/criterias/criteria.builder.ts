import { NameCriteria, CompositeCriteria, UserIdCriteria, IdCriteria, EmailCriteria } from '.';

export class CriteriaBuilder {
  public static composite() {
    return new CompositeCriteria();
  }
}

export const Name = NameCriteria;
export const Email = EmailCriteria;
export const UserId = UserIdCriteria;
export const Id = IdCriteria;
export const composite = CriteriaBuilder.composite();
