export class Exception extends Error {
  public readonly params: object;

  constructor(message: string, params: object = {}) {
    super(message);
    this.params = params;
  }
}
