export function renderRoundedFavicon(
  image: HTMLImageElement,
  canvas: HTMLCanvasElement = document.createElement('canvas')
): string | null {
  if (!image.complete || image.naturalWidth === 0 || image.naturalHeight === 0) {
    return null;
  }

  try {
    const size = 64;
    const radius = 4 * (size / 32);
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext('2d');
    if (!context) return null;

    context.beginPath();
    context.roundRect(0, 0, size, size, radius);
    context.closePath();
    context.clip();
    context.drawImage(image, 0, 0, size, size);

    return canvas.toDataURL('image/png');
  } catch {
    return null;
  }
}
