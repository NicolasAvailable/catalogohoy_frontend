import { assert } from '../../assert/assert';

describe('assert', () => {
  it('should not throw an error when the condition is true', () => {
    expect(() => assert(true, 'Should not throw')).not.toThrow();
  });

  it('should throw an error with the provided message when the condition is false', () => {
    const errorMessage = 'Test error message';
    expect(() => assert(false, errorMessage)).toThrow(errorMessage);
  });

  it('should throw an Error instance', () => {
    expect(() => assert(false, 'Error')).toThrow(Error);
  });

  it('should work with falsy values other than false', () => {
    expect(() => assert(0 as any, 'Zero is falsy')).toThrow('Zero is falsy');
    expect(() => assert('' as any, 'Empty string is falsy')).toThrow('Empty string is falsy');
    expect(() => assert(null as any, 'null is falsy')).toThrow('null is falsy');
    expect(() => assert(undefined as any, 'undefined is falsy')).toThrow('undefined is falsy');
  });
});
