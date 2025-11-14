import { ColorConverter } from '../../color/color-converter';

describe('ColorConverter', () => {
  describe('isValidHex', () => {
    it('should return true for valid hex colors', () => {
      expect(ColorConverter.isValidHex('#FF0000')).toBe(true);
      expect(ColorConverter.isValidHex('#000')).toBe(true);
      expect(ColorConverter.isValidHex('#123456')).toBe(true);
    });

    it('should return false for invalid hex colors', () => {
      expect(ColorConverter.isValidHex('')).toBe(false);
      expect(ColorConverter.isValidHex('FF0000')).toBe(false);
      expect(ColorConverter.isValidHex('invalid')).toBe(false);
    });
  });

  describe('expandShortHex', () => {
    it('should expand short hex format', () => {
      expect(ColorConverter.expandShortHex('#F0A')).toBe('FF00AA');
      expect(ColorConverter.expandShortHex('#000')).toBe('000000');
      expect(ColorConverter.expandShortHex('#FFF')).toBe('FFFFFF');
    });

    it('should keep full hex format unchanged', () => {
      expect(ColorConverter.expandShortHex('#FF00AA')).toBe('FF00AA');
      expect(ColorConverter.expandShortHex('#123456')).toBe('123456');
    });
  });

  describe('hexToRgb', () => {
    it('should convert valid hex to RGB', () => {
      expect(ColorConverter.hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
      expect(ColorConverter.hexToRgb('#00FF00')).toEqual({ r: 0, g: 255, b: 0 });
      expect(ColorConverter.hexToRgb('#0000FF')).toEqual({ r: 0, g: 0, b: 255 });
      expect(ColorConverter.hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
      expect(ColorConverter.hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
    });

    it('should handle short hex format', () => {
      expect(ColorConverter.hexToRgb('#F00')).toEqual({ r: 255, g: 0, b: 0 });
      expect(ColorConverter.hexToRgb('#0F0')).toEqual({ r: 0, g: 255, b: 0 });
      expect(ColorConverter.hexToRgb('#00F')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should return black for invalid hex', () => {
      expect(ColorConverter.hexToRgb('')).toEqual({ r: 0, g: 0, b: 0 });
      expect(ColorConverter.hexToRgb('invalid')).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('rgbToNormalized', () => {
    it('should normalize RGB values to 0-1 range', () => {
      expect(ColorConverter.rgbToNormalized({ r: 255, g: 0, b: 0 })).toEqual({ r: 1, g: 0, b: 0 });
      expect(ColorConverter.rgbToNormalized({ r: 128, g: 128, b: 128 })).toEqual({
        r: 0.5019607843137255,
        g: 0.5019607843137255,
        b: 0.5019607843137255,
      });
      expect(ColorConverter.rgbToNormalized({ r: 0, g: 0, b: 0 })).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('rgbToHsl', () => {
    it('should convert RGB to HSL correctly', () => {
      // Red
      const red = ColorConverter.rgbToHsl({ r: 255, g: 0, b: 0 });
      expect(red.h).toBeCloseTo(0);
      expect(red.s).toBeCloseTo(1);
      expect(red.l).toBeCloseTo(0.5);

      // Green
      const green = ColorConverter.rgbToHsl({ r: 0, g: 255, b: 0 });
      expect(green.h).toBeCloseTo(0.333, 2);
      expect(green.s).toBeCloseTo(1);
      expect(green.l).toBeCloseTo(0.5);

      // Blue
      const blue = ColorConverter.rgbToHsl({ r: 0, g: 0, b: 255 });
      expect(blue.h).toBeCloseTo(0.667, 2);
      expect(blue.s).toBeCloseTo(1);
      expect(blue.l).toBeCloseTo(0.5);

      // Black
      const black = ColorConverter.rgbToHsl({ r: 0, g: 0, b: 0 });
      expect(black.h).toBe(0);
      expect(black.s).toBe(0);
      expect(black.l).toBe(0);

      // White
      const white = ColorConverter.rgbToHsl({ r: 255, g: 255, b: 255 });
      expect(white.h).toBe(0);
      expect(white.s).toBe(0);
      expect(white.l).toBe(1);
    });
  });

  describe('hslToRgb', () => {
    it('should convert HSL to RGB correctly', () => {
      // Red
      expect(ColorConverter.hslToRgb({ h: 0, s: 1, l: 0.5 })).toEqual({ r: 255, g: 0, b: 0 });

      // Green
      const green = ColorConverter.hslToRgb({ h: 1 / 3, s: 1, l: 0.5 });
      expect(green.r).toBeCloseTo(0, 0);
      expect(green.g).toBeCloseTo(255, 0);
      expect(green.b).toBeCloseTo(0, 0);

      // Blue
      const blue = ColorConverter.hslToRgb({ h: 2 / 3, s: 1, l: 0.5 });
      expect(blue.r).toBeCloseTo(0, 0);
      expect(blue.g).toBeCloseTo(0, 0);
      expect(blue.b).toBeCloseTo(255, 0);

      // Black
      expect(ColorConverter.hslToRgb({ h: 0, s: 0, l: 0 })).toEqual({ r: 0, g: 0, b: 0 });

      // White
      expect(ColorConverter.hslToRgb({ h: 0, s: 0, l: 1 })).toEqual({ r: 255, g: 255, b: 255 });

      // Gray (achromatic)
      expect(ColorConverter.hslToRgb({ h: 0, s: 0, l: 0.5 })).toEqual({ r: 128, g: 128, b: 128 });
    });
  });

  describe('rgbToHex', () => {
    it('should convert RGB to hex correctly', () => {
      expect(ColorConverter.rgbToHex({ r: 255, g: 0, b: 0 })).toBe('#ff0000');
      expect(ColorConverter.rgbToHex({ r: 0, g: 255, b: 0 })).toBe('#00ff00');
      expect(ColorConverter.rgbToHex({ r: 0, g: 0, b: 255 })).toBe('#0000ff');
      expect(ColorConverter.rgbToHex({ r: 255, g: 255, b: 255 })).toBe('#ffffff');
      expect(ColorConverter.rgbToHex({ r: 0, g: 0, b: 0 })).toBe('#000000');
    });

    it('should handle single digit hex values', () => {
      expect(ColorConverter.rgbToHex({ r: 1, g: 2, b: 3 })).toBe('#010203');
      expect(ColorConverter.rgbToHex({ r: 15, g: 15, b: 15 })).toBe('#0f0f0f');
    });

    it('should clamp values outside 0-255 range', () => {
      expect(ColorConverter.rgbToHex({ r: -10, g: 300, b: 128 })).toBe('#00ff80');
    });
  });

  describe('hexToHsl', () => {
    it('should convert hex to HSL correctly', () => {
      const red = ColorConverter.hexToHsl('#FF0000');
      expect(red.h).toBeCloseTo(0);
      expect(red.s).toBeCloseTo(1);
      expect(red.l).toBeCloseTo(0.5);

      const black = ColorConverter.hexToHsl('#000000');
      expect(black.h).toBe(0);
      expect(black.s).toBe(0);
      expect(black.l).toBe(0);
    });
  });

  describe('hslToHex', () => {
    it('should convert HSL to hex correctly', () => {
      expect(ColorConverter.hslToHex({ h: 0, s: 1, l: 0.5 })).toBe('#ff0000');
      expect(ColorConverter.hslToHex({ h: 0, s: 0, l: 0 })).toBe('#000000');
      expect(ColorConverter.hslToHex({ h: 0, s: 0, l: 1 })).toBe('#ffffff');
    });
  });

  describe('round-trip conversions', () => {
    it('should maintain color integrity through hex->rgb->hex conversion', () => {
      const originalHex = '#FF8800';
      const rgb = ColorConverter.hexToRgb(originalHex);
      const backToHex = ColorConverter.rgbToHex(rgb);
      expect(backToHex.toLowerCase()).toBe(originalHex.toLowerCase());
    });

    it('should maintain color integrity through hex->hsl->hex conversion', () => {
      const originalHex = '#FF8800';
      const hsl = ColorConverter.hexToHsl(originalHex);
      const backToHex = ColorConverter.hslToHex(hsl);
      expect(backToHex.toLowerCase()).toBe(originalHex.toLowerCase());
    });
  });
});
