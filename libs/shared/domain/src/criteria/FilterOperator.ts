export enum Operator {
  EQUAL = '=',
  NOT_EQUAL = '!=',
  GT = '>',
  LT = '<',
  GTE = '>=',
  LTE = '<=',
  CONTAINS = 'CONTAINS',
  NOT_CONTAINS = 'NOT_CONTAINS',
}

export class FilterOperator {
  constructor(public readonly value: Operator) {}
}
