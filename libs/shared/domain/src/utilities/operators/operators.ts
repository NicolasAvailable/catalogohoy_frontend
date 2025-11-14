abstract class LogicalOperator {
  abstract evaluate(): boolean;
}

class Not extends LogicalOperator {
  constructor(private readonly operand: LogicalOperator) {
    super();
  }

  public evaluate(): boolean {
    return !this.operand.evaluate();
  }
}

class And extends LogicalOperator {
  private readonly values: LogicalOperator[] = [];

  constructor(...args: LogicalOperator[]) {
    super();
    this.values.push(...args);
  }

  public evaluate(): boolean {
    return this.values.reduce((acc, arg) => acc && arg.evaluate(), !!this.values[0]?.evaluate());
  }
}

class Or extends LogicalOperator {
  private readonly values: LogicalOperator[] = [];

  constructor(...args: LogicalOperator[]) {
    super();
    this.values.push(...args);
  }

  public evaluate(): boolean {
    return this.values.reduce((acc, arg) => acc || arg.evaluate(), !!this.values[0]?.evaluate());
  }
}

class Value extends LogicalOperator {
  constructor(private readonly value: unknown) {
    super();
  }

  public evaluate(): boolean {
    return !!this.value;
  }
}

export const not = (condition: unknown) => new Not(new Value(boolean(condition))).evaluate();
export const and = (...args: boolean[]) => new And(...args.map((arg) => new Value(arg))).evaluate();
export const or = (...args: boolean[]) => new Or(...args.map((arg) => new Value(arg))).evaluate();
export const boolean = (value: unknown) => new Value(value).evaluate();
