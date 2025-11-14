export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export interface HslColor {
  h: number;
  s: number;
  l: number;
}

export class ColorConverter {
  private static readonly HEX_PREFIX = '#';
  private static readonly SHORT_HEX_LENGTH = 3;
  private static readonly HEX_HASH_INDEX = 1;
  private static readonly HEX_BASE = 16;
  private static readonly RGB_MAX_VALUE = 255;
  private static readonly RGB_RED_START = 0;
  private static readonly RGB_RED_END = 2;
  private static readonly RGB_GREEN_START = 2;
  private static readonly RGB_GREEN_END = 4;
  private static readonly RGB_BLUE_START = 4;
  private static readonly RGB_BLUE_END = 6;
  private static readonly LIGHTNESS_THRESHOLD = 0.5;
  private static readonly LIGHTNESS_DIVISOR = 2;
  private static readonly HUE_SECTORS = 6;
  private static readonly HUE_GREEN_OFFSET = 2;
  private static readonly HUE_BLUE_OFFSET = 4;
  private static readonly HUE_WRAP_VALUE = 6;

  public static isValidHex(hex: string): boolean {
    return Boolean(hex && hex.startsWith(ColorConverter.HEX_PREFIX));
  }

  public static expandShortHex(hex: string): string {
    const cleanHex = hex.slice(ColorConverter.HEX_HASH_INDEX);
    return cleanHex.length === ColorConverter.SHORT_HEX_LENGTH
      ? cleanHex
          .split('')
          .map((char) => char + char)
          .join('')
      : cleanHex;
  }

  public static hexToRgb(hex: string): RgbColor {
    if (!ColorConverter.isValidHex(hex)) {
      return { r: 0, g: 0, b: 0 };
    }

    const fullHex = ColorConverter.expandShortHex(hex);

    const r = parseInt(
      fullHex.slice(ColorConverter.RGB_RED_START, ColorConverter.RGB_RED_END),
      ColorConverter.HEX_BASE
    );
    const g = parseInt(
      fullHex.slice(ColorConverter.RGB_GREEN_START, ColorConverter.RGB_GREEN_END),
      ColorConverter.HEX_BASE
    );
    const b = parseInt(
      fullHex.slice(ColorConverter.RGB_BLUE_START, ColorConverter.RGB_BLUE_END),
      ColorConverter.HEX_BASE
    );

    return { r, g, b };
  }

  public static hexToHsl(hex: string): HslColor {
    return ColorConverter.rgbToHsl(ColorConverter.hexToRgb(hex));
  }

  public static rgbToNormalized(rgb: RgbColor): RgbColor {
    return {
      r: rgb.r / ColorConverter.RGB_MAX_VALUE,
      g: rgb.g / ColorConverter.RGB_MAX_VALUE,
      b: rgb.b / ColorConverter.RGB_MAX_VALUE,
    };
  }

  public static rgbToHsl(rgb: RgbColor): HslColor {
    const normalized = ColorConverter.rgbToNormalized(rgb);
    const { r, g, b } = normalized;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;
    const sum = max + min;

    const l = sum / ColorConverter.LIGHTNESS_DIVISOR;

    let h = 0;
    let s = 0;

    if (diff !== 0) {
      s = l > ColorConverter.LIGHTNESS_THRESHOLD ? diff / (ColorConverter.LIGHTNESS_DIVISOR - sum) : diff / sum;

      h = ColorConverter.calculateHue(r, g, b, max, diff);
      h /= ColorConverter.HUE_SECTORS;
    }

    return { h, s, l };
  }

  public static hslToRgb(hsl: HslColor): RgbColor {
    const { h, s, l } = hsl;
    let r: number, g: number, b: number;

    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < ColorConverter.LIGHTNESS_THRESHOLD ? l * (1 + s) : l + s - l * s;
      const p = ColorConverter.LIGHTNESS_DIVISOR * l - q;

      r = ColorConverter.hue2rgb(p, q, h + 1 / 3);
      g = ColorConverter.hue2rgb(p, q, h);
      b = ColorConverter.hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * ColorConverter.RGB_MAX_VALUE),
      g: Math.round(g * ColorConverter.RGB_MAX_VALUE),
      b: Math.round(b * ColorConverter.RGB_MAX_VALUE),
    };
  }

  public static rgbToHex(rgb: RgbColor): string {
    const toHex = (n: number): string => {
      const clampedValue = Math.max(0, Math.min(ColorConverter.RGB_MAX_VALUE, n));
      const hex = clampedValue.toString(ColorConverter.HEX_BASE);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `${ColorConverter.HEX_PREFIX}${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`;
  }

  public static hslToHex(hsl: HslColor): string {
    return ColorConverter.rgbToHex(ColorConverter.hslToRgb(hsl));
  }

  private static calculateHue(r: number, g: number, b: number, max: number, diff: number): number {
    switch (max) {
      case r:
        return (g - b) / diff + (g < b ? ColorConverter.HUE_WRAP_VALUE : 0);
      case g:
        return (b - r) / diff + ColorConverter.HUE_GREEN_OFFSET;
      case b:
        return (r - g) / diff + ColorConverter.HUE_BLUE_OFFSET;
      default:
        return 0;
    }
  }

  private static hue2rgb(p: number, q: number, t: number): number {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  }
}
