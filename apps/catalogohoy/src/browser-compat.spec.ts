describe('browser compatibility polyfills', () => {
  const nativeHasOwn = Object.hasOwn;

  afterEach(() => {
    Object.defineProperty(Object, 'hasOwn', {
      value: nativeHasOwn,
      configurable: true,
      writable: true,
    });
    jest.resetModules();
  });

  it('adds Object.hasOwn when the browser does not provide it', async () => {
    delete (Object as { hasOwn?: typeof Object.hasOwn }).hasOwn;

    await import('./browser-compat');

    expect(Object.hasOwn({ product: true }, 'product')).toBe(true);
    expect(Object.hasOwn(Object.create({ inherited: true }), 'inherited')).toBe(false);
  });

  it('does not replace the native implementation', async () => {
    await import('./browser-compat');

    expect(Object.hasOwn).toBe(nativeHasOwn);
  });
});
