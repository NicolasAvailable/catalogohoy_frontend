import { sleep, trigger } from '../../sleep/sleep';

describe('sleep', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('should resolve after the specified time', async () => {
    const ms = 1000;
    const sleepPromise = sleep(ms);

    jest.advanceTimersByTime(ms);

    await expect(sleepPromise).resolves.toBeUndefined();
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), ms);
  });

  it('should not wait when when: false is provided', async () => {
    const ms = 1000;
    const sleepPromise = sleep(ms, { when: false });

    expect(sleepPromise).resolves.toBeUndefined();
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), 0);
  });

  it('should wait when when: true is provided', async () => {
    const ms = 1000;
    const sleepPromise = sleep(ms, { when: true });

    jest.advanceTimersByTime(ms);

    await expect(sleepPromise).resolves.toBeUndefined();
    expect(setTimeout).toHaveBeenCalledTimes(1);
    expect(setTimeout).toHaveBeenLastCalledWith(expect.any(Function), ms);
  });

  it('should handle multiple sleep calls', async () => {
    const ms1 = 1000;
    const ms2 = 2000;

    const sleepPromise1 = sleep(ms1);
    const sleepPromise2 = sleep(ms2);

    jest.advanceTimersByTime(ms2);

    await Promise.all([expect(sleepPromise1).resolves.toBeUndefined(), expect(sleepPromise2).resolves.toBeUndefined()]);

    expect(setTimeout).toHaveBeenCalledTimes(2);
  });
});

describe('trigger', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(global, 'setTimeout');
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllTimers();
  });

  it('should execute function immediately and return sleep promise', async () => {
    const mockFn = jest.fn().mockReturnValue('test result');
    const ms = 1000;

    const triggerResult = trigger(mockFn);
    const sleepPromise = triggerResult.sleep(ms);

    expect(mockFn).toHaveBeenCalledTimes(1);
    expect(mockFn).toHaveBeenCalledWith();

    jest.advanceTimersByTime(ms);

    const result = await sleepPromise;
    expect(result).toBe('test result');
  });

  it('should execute function with side effects immediately', async () => {
    let counter = 0;
    const sideEffectFn = jest.fn(() => {
      counter = 42;
      return 'executed';
    });

    const triggerResult = trigger(sideEffectFn);
    
    expect(sideEffectFn).toHaveBeenCalledTimes(1);
    expect(counter).toBe(42);

    const sleepPromise = triggerResult.sleep(500);
    jest.advanceTimersByTime(500);

    const result = await sleepPromise;
    expect(result).toBe('executed');
  });

  it('should work with void functions', async () => {
    const voidFn = jest.fn();
    const ms = 200;

    const triggerResult = trigger(voidFn);
    const sleepPromise = triggerResult.sleep(ms);

    expect(voidFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(ms);

    const result = await sleepPromise;
    expect(result).toBeUndefined();
  });

  it('should preserve function return value after sleep', async () => {
    const returnValue = { data: 'test', count: 123 };
    const mockFn = jest.fn().mockReturnValue(returnValue);

    const triggerResult = trigger(mockFn);
    const sleepPromise = triggerResult.sleep(1500);

    expect(mockFn).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1500);

    const result = await sleepPromise;
    expect(result).toEqual(returnValue);
    expect(result).toBe(returnValue); // Same reference
  });

  it('should handle function that throws error', async () => {
    const errorFn = jest.fn(() => {
      throw new Error('Test error');
    });

    expect(() => trigger(errorFn)).toThrow('Test error');
    expect(errorFn).toHaveBeenCalledTimes(1);
  });

  it('should work with different sleep durations', async () => {
    const mockFn = jest.fn().mockReturnValue('result');
    
    const triggerResult = trigger(mockFn);
    
    // Test multiple sleep calls with different durations
    const sleep1 = triggerResult.sleep(100);
    const sleep2 = triggerResult.sleep(300);
    
    expect(mockFn).toHaveBeenCalledTimes(1); // Function called only once
    
    jest.advanceTimersByTime(300);
    
    const [result1, result2] = await Promise.all([sleep1, sleep2]);
    expect(result1).toBe('result');
    expect(result2).toBe('result');
  });
});
