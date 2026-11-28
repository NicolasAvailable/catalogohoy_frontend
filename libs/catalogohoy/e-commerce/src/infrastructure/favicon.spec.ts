import { renderRoundedFavicon } from './favicon';

function image(overrides: Partial<HTMLImageElement> = {}): HTMLImageElement {
  return {
    complete: true,
    naturalWidth: 128,
    naturalHeight: 128,
    ...overrides,
  } as HTMLImageElement;
}

function canvas(drawImage: jest.Mock = jest.fn()) {
  const context = {
    beginPath: jest.fn(),
    roundRect: jest.fn(),
    closePath: jest.fn(),
    clip: jest.fn(),
    drawImage,
  } as unknown as CanvasRenderingContext2D;
  const element = {
    width: 0,
    height: 0,
    getContext: jest.fn(() => context),
    toDataURL: jest.fn(() => 'data:image/png;base64,ok'),
  } as unknown as HTMLCanvasElement;
  return { element, context };
}

describe('renderRoundedFavicon', () => {
  it('renders a loaded image using the normal path', () => {
    const target = canvas();

    expect(renderRoundedFavicon(image(), target.element)).toBe(
      'data:image/png;base64,ok'
    );
    expect(target.context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      64,
      64
    );
  });

  it('returns the fallback signal when the image is already broken', () => {
    const target = canvas();

    expect(
      renderRoundedFavicon(
        image({ naturalWidth: 0, naturalHeight: 0 }),
        target.element
      )
    ).toBeNull();
    expect(target.context.drawImage).not.toHaveBeenCalled();
  });

  it('returns the fallback signal when drawImage invalidates the image', () => {
    const target = canvas(
      jest.fn(() => {
        throw new DOMException('The image is in the broken state', 'InvalidStateError');
      })
    );

    expect(renderRoundedFavicon(image(), target.element)).toBeNull();
  });
});
