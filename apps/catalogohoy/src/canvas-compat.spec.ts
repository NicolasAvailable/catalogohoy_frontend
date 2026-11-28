describe('canvas compatibility', () => {
  const originalContext = globalThis.CanvasRenderingContext2D;

  afterEach(() => {
    jest.resetModules();
    Object.defineProperty(globalThis, 'CanvasRenderingContext2D', {
      configurable: true,
      value: originalContext,
    });
  });

  it('installs roundRect when the browser does not provide it', async () => {
    class LegacyCanvasContext {
      moveTo = jest.fn();
      lineTo = jest.fn();
      arcTo = jest.fn();
      closePath = jest.fn();
    }
    Object.defineProperty(globalThis, 'CanvasRenderingContext2D', {
      configurable: true,
      value: LegacyCanvasContext,
    });

    await import('./canvas-compat');

    const context =
      new LegacyCanvasContext() as unknown as CanvasRenderingContext2D;
    expect(typeof context.roundRect).toBe('function');
    context.roundRect(10, 20, 100, 60, 8);
    expect(context.moveTo).toHaveBeenCalledWith(18, 20);
    expect(context.arcTo).toHaveBeenCalledTimes(4);
    expect(context.closePath).toHaveBeenCalledTimes(1);
  });

  it('keeps the native implementation when it exists', async () => {
    const nativeRoundRect = jest.fn();
    class ModernCanvasContext {}
    ModernCanvasContext.prototype.roundRect = nativeRoundRect;
    Object.defineProperty(globalThis, 'CanvasRenderingContext2D', {
      configurable: true,
      value: ModernCanvasContext,
    });

    await import('./canvas-compat');

    expect(ModernCanvasContext.prototype.roundRect).toBe(nativeRoundRect);
  });
});
