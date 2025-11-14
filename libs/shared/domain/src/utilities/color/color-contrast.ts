import { ColorConverter } from './color-converter';

export class ColorContrast {
  private static readonly WHITE = '#ffffff';
  private static readonly BLACK = '#7d7d7d';

  private static readonly LUMINANCE_THRESHOLD = 0.179;
  private static readonly GAMMA_CORRECTION = 2.4;
  private static readonly LINEAR_THRESHOLD = 0.03928;
  private static readonly LINEAR_MULTIPLIER = 12.92;
  private static readonly GAMMA_OFFSET = 0.055;
  private static readonly GAMMA_DIVISOR = 1.055;

  public static getOptimalTextColor(backgroundColor: string): string {
    return this.calculateLuminance(backgroundColor) > this.LUMINANCE_THRESHOLD ? this.BLACK : this.WHITE;
  }

  public static calculateLuminance(hexColor: string): number {
    const rgb = ColorConverter.hexToRgb(this.normalizeHexColor(hexColor));

    const r = this.getRelativeLuminanceComponent(rgb.r / 255);
    const g = this.getRelativeLuminanceComponent(rgb.g / 255);
    const b = this.getRelativeLuminanceComponent(rgb.b / 255);

    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  private static getRelativeLuminanceComponent(component: number): number {
    if (component <= this.LINEAR_THRESHOLD) {
      return component / this.LINEAR_MULTIPLIER;
    }
    return Math.pow((component + this.GAMMA_OFFSET) / this.GAMMA_DIVISOR, this.GAMMA_CORRECTION);
  }

  private static normalizeHexColor(hexColor: string): string {
    if (!hexColor) return '#000000';

    const cleanHex = hexColor.replace('#', '');

    const expandedHex =
      cleanHex.length === 3
        ? cleanHex
            .split('')
            .map((char) => char + char)
            .join('')
        : cleanHex;

    return '#' + expandedHex;
  }
}
