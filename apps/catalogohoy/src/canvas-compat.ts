/** Canvas API fallbacks for browsers and embedded WebViews still in use. */
if (
  typeof CanvasRenderingContext2D !== 'undefined' &&
  typeof CanvasRenderingContext2D.prototype.roundRect !== 'function'
) {
  CanvasRenderingContext2D.prototype.roundRect = function roundRect(
    this: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radii: number | DOMPointInit | (number | DOMPointInit)[] = 0
  ): void {
    let corners = Array.isArray(radii) ? radii : [radii];
    if (corners.length === 1)
      corners = [corners[0], corners[0], corners[0], corners[0]];
    else if (corners.length === 2)
      corners = [corners[0], corners[1], corners[0], corners[1]];
    else if (corners.length === 3)
      corners = [corners[0], corners[1], corners[2], corners[1]];

    const [topLeft, topRight, bottomRight, bottomLeft] = corners
      .slice(0, 4)
      .map((corner) => (typeof corner === 'number' ? Math.max(0, corner) : 0))
      .map((radius) =>
        Math.min(radius, Math.abs(width) / 2, Math.abs(height) / 2)
      );

    this.moveTo(x + topLeft, y);
    this.lineTo(x + width - topRight, y);
    this.arcTo(x + width, y, x + width, y + topRight, topRight);
    this.lineTo(x + width, y + height - bottomRight);
    this.arcTo(
      x + width,
      y + height,
      x + width - bottomRight,
      y + height,
      bottomRight
    );
    this.lineTo(x + bottomLeft, y + height);
    this.arcTo(x, y + height, x, y + height - bottomLeft, bottomLeft);
    this.lineTo(x, y + topLeft);
    this.arcTo(x, y, x + topLeft, y, topLeft);
    this.closePath();
  };
}
