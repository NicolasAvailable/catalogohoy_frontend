import { ColorConverter, RgbColor, HslColor } from './color-converter';

export class ColorFormatter {
  private static readonly RGB_PREFIX = 'rgb(';
  private static readonly RGB_PATTERN = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/;
  private static readonly HSL_PREFIX = 'hsl(';
  private static readonly HSL_PATTERN = /hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)/;
  private static readonly RGB_RED_INDEX = 1;
  private static readonly RGB_GREEN_INDEX = 2;
  private static readonly RGB_BLUE_INDEX = 3;
  private static readonly HSL_HUE_INDEX = 1;
  private static readonly HSL_SATURATION_INDEX = 2;
  private static readonly HSL_LIGHTNESS_INDEX = 3;
  private static readonly DECIMAL_BASE = 10;
  private static readonly DEGREES_IN_CIRCLE = 360;
  private static readonly PERCENTAGE_DIVISOR = 100;
  private static readonly PERCENTAGE_MULTIPLIER = 100;
  private static readonly DEFAULT_HEX = '#ffffff';
  private static readonly DEFAULT_RGB = 'rgb(255, 255, 255)';
  private static readonly DEFAULT_HSL = 'hsl(0, 0%, 100%)';

  public static rgbToString(rgb: RgbColor): string {
    return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
  }

  public static hslToString(hsl: HslColor): string {
    const hDeg = Math.round(hsl.h * ColorFormatter.DEGREES_IN_CIRCLE);
    const sPercent = Math.round(hsl.s * ColorFormatter.PERCENTAGE_MULTIPLIER);
    const lPercent = Math.round(hsl.l * ColorFormatter.PERCENTAGE_MULTIPLIER);

    return `hsl(${hDeg}, ${sPercent}%, ${lPercent}%)`;
  }

  public static parseRgb(rgb: string): RgbColor {
    if (!rgb || !rgb.startsWith(ColorFormatter.RGB_PREFIX)) {
      return { r: 0, g: 0, b: 0 };
    }

    const match = rgb.match(ColorFormatter.RGB_PATTERN);
    if (!match) {
      return { r: 0, g: 0, b: 0 };
    }

    return {
      r: parseInt(match[ColorFormatter.RGB_RED_INDEX], ColorFormatter.DECIMAL_BASE),
      g: parseInt(match[ColorFormatter.RGB_GREEN_INDEX], ColorFormatter.DECIMAL_BASE),
      b: parseInt(match[ColorFormatter.RGB_BLUE_INDEX], ColorFormatter.DECIMAL_BASE),
    };
  }

  public static parseHsl(hsl: string): HslColor {
    if (!hsl || !hsl.startsWith(ColorFormatter.HSL_PREFIX)) {
      return { h: 0, s: 0, l: 0 };
    }

    const match = hsl.match(ColorFormatter.HSL_PATTERN);
    if (!match) {
      return { h: 0, s: 0, l: 0 };
    }

    return {
      h: parseInt(match[ColorFormatter.HSL_HUE_INDEX], ColorFormatter.DECIMAL_BASE) / ColorFormatter.DEGREES_IN_CIRCLE,
      s:
        parseInt(match[ColorFormatter.HSL_SATURATION_INDEX], ColorFormatter.DECIMAL_BASE) /
        ColorFormatter.PERCENTAGE_DIVISOR,
      l:
        parseInt(match[ColorFormatter.HSL_LIGHTNESS_INDEX], ColorFormatter.DECIMAL_BASE) /
        ColorFormatter.PERCENTAGE_DIVISOR,
    };
  }

  public static hexToRgbString(hex: string): string {
    if (!ColorConverter.isValidHex(hex)) {
      return ColorFormatter.DEFAULT_RGB;
    }

    const rgb = ColorConverter.hexToRgb(hex);
    return ColorFormatter.rgbToString(rgb);
  }

  public static hexToHslString(hex: string): string {
    if (!ColorConverter.isValidHex(hex)) {
      return ColorFormatter.DEFAULT_HSL;
    }

    const hsl = ColorConverter.hexToHsl(hex);
    return ColorFormatter.hslToString(hsl);
  }

  public static rgbStringToHex(rgb: string): string {
    const rgbColor = ColorFormatter.parseRgb(rgb);
    if (rgbColor.r === 0 && rgbColor.g === 0 && rgbColor.b === 0 && rgb !== ColorFormatter.DEFAULT_RGB) {
      return ColorFormatter.DEFAULT_HEX;
    }

    return ColorConverter.rgbToHex(rgbColor);
  }

  public static hslStringToHex(hsl: string): string {
    const hslColor = ColorFormatter.parseHsl(hsl);
    if (hslColor.h === 0 && hslColor.s === 0 && hslColor.l === 0 && hsl !== ColorFormatter.DEFAULT_HSL) {
      return ColorFormatter.DEFAULT_HEX;
    }

    return ColorConverter.hslToHex(hslColor);
  }

  public static safeHexString(hex: string): string {
    return ColorConverter.isValidHex(hex) ? hex : ColorFormatter.DEFAULT_HEX;
  }
}
