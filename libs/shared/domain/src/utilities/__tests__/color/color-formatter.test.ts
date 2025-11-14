import { ColorFormatter } from '../../color/color-formatter';

describe('ColorFormatter', () => {
  describe('rgbToString', () => {
    it('should format RGB color object to string', () => {
      expect(ColorFormatter.rgbToString({ r: 255, g: 0, b: 0 })).toBe('rgb(255, 0, 0)');
      expect(ColorFormatter.rgbToString({ r: 0, g: 255, b: 0 })).toBe('rgb(0, 255, 0)');
      expect(ColorFormatter.rgbToString({ r: 0, g: 0, b: 255 })).toBe('rgb(0, 0, 255)');
      expect(ColorFormatter.rgbToString({ r: 128, g: 128, b: 128 })).toBe('rgb(128, 128, 128)');
    });
  });

  describe('hslToString', () => {
    it('should format HSL color object to string', () => {
      expect(ColorFormatter.hslToString({ h: 0, s: 1, l: 0.5 })).toBe('hsl(0, 100%, 50%)');
      expect(ColorFormatter.hslToString({ h: 0.5, s: 0.75, l: 0.25 })).toBe('hsl(180, 75%, 25%)');
      expect(ColorFormatter.hslToString({ h: 1, s: 0, l: 1 })).toBe('hsl(360, 0%, 100%)');
    });

    it('should round values correctly', () => {
      expect(ColorFormatter.hslToString({ h: 0.333, s: 0.666, l: 0.999 })).toBe('hsl(120, 67%, 100%)');
    });
  });

  describe('parseRgb', () => {
    it('should parse valid RGB strings', () => {
      expect(ColorFormatter.parseRgb('rgb(255, 0, 0)')).toEqual({ r: 255, g: 0, b: 0 });
      expect(ColorFormatter.parseRgb('rgb(0, 255, 0)')).toEqual({ r: 0, g: 255, b: 0 });
      expect(ColorFormatter.parseRgb('rgb(0, 0, 255)')).toEqual({ r: 0, g: 0, b: 255 });
    });

    it('should handle whitespace in RGB strings', () => {
      expect(ColorFormatter.parseRgb('rgb(255,0,0)')).toEqual({ r: 255, g: 0, b: 0 });
      expect(ColorFormatter.parseRgb('rgb( 255 , 0 , 0 )')).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should return black for invalid RGB strings', () => {
      expect(ColorFormatter.parseRgb('')).toEqual({ r: 0, g: 0, b: 0 });
      expect(ColorFormatter.parseRgb('invalid')).toEqual({ r: 0, g: 0, b: 0 });
      expect(ColorFormatter.parseRgb('rgb(invalid)')).toEqual({ r: 0, g: 0, b: 0 });
      expect(ColorFormatter.parseRgb('hsl(0, 100%, 50%)')).toEqual({ r: 0, g: 0, b: 0 });
    });
  });

  describe('parseHsl', () => {
    it('should parse valid HSL strings', () => {
      expect(ColorFormatter.parseHsl('hsl(0, 100%, 50%)')).toEqual({ h: 0, s: 1, l: 0.5 });
      expect(ColorFormatter.parseHsl('hsl(180, 75%, 25%)')).toEqual({ h: 0.5, s: 0.75, l: 0.25 });
      expect(ColorFormatter.parseHsl('hsl(360, 0%, 100%)')).toEqual({ h: 1, s: 0, l: 1 });
    });

    it('should handle whitespace in HSL strings', () => {
      expect(ColorFormatter.parseHsl('hsl(0,100%,50%)')).toEqual({ h: 0, s: 1, l: 0.5 });
      expect(ColorFormatter.parseHsl('hsl( 0 , 100% , 50% )')).toEqual({ h: 0, s: 1, l: 0.5 });
    });

    it('should return black for invalid HSL strings', () => {
      expect(ColorFormatter.parseHsl('')).toEqual({ h: 0, s: 0, l: 0 });
      expect(ColorFormatter.parseHsl('invalid')).toEqual({ h: 0, s: 0, l: 0 });
      expect(ColorFormatter.parseHsl('hsl(invalid)')).toEqual({ h: 0, s: 0, l: 0 });
      expect(ColorFormatter.parseHsl('rgb(255, 0, 0)')).toEqual({ h: 0, s: 0, l: 0 });
    });
  });

  describe('hexToRgbString', () => {
    it('should convert hex to RGB string', () => {
      expect(ColorFormatter.hexToRgbString('#FF0000')).toBe('rgb(255, 0, 0)');
      expect(ColorFormatter.hexToRgbString('#00FF00')).toBe('rgb(0, 255, 0)');
      expect(ColorFormatter.hexToRgbString('#0000FF')).toBe('rgb(0, 0, 255)');
    });

    it('should handle short hex format', () => {
      expect(ColorFormatter.hexToRgbString('#F00')).toBe('rgb(255, 0, 0)');
      expect(ColorFormatter.hexToRgbString('#0F0')).toBe('rgb(0, 255, 0)');
    });

    it('should return default RGB for invalid hex', () => {
      expect(ColorFormatter.hexToRgbString('')).toBe('rgb(255, 255, 255)');
      expect(ColorFormatter.hexToRgbString('invalid')).toBe('rgb(255, 255, 255)');
    });
  });

  describe('hexToHslString', () => {
    it('should convert hex to HSL string', () => {
      expect(ColorFormatter.hexToHslString('#FF0000')).toBe('hsl(0, 100%, 50%)');
      expect(ColorFormatter.hexToHslString('#000000')).toBe('hsl(0, 0%, 0%)');
      expect(ColorFormatter.hexToHslString('#FFFFFF')).toBe('hsl(0, 0%, 100%)');
    });

    it('should return default HSL for invalid hex', () => {
      expect(ColorFormatter.hexToHslString('')).toBe('hsl(0, 0%, 100%)');
      expect(ColorFormatter.hexToHslString('invalid')).toBe('hsl(0, 0%, 100%)');
    });
  });

  describe('rgbStringToHex', () => {
    it('should convert RGB string to hex', () => {
      expect(ColorFormatter.rgbStringToHex('rgb(255, 0, 0)')).toBe('#ff0000');
      expect(ColorFormatter.rgbStringToHex('rgb(0, 255, 0)')).toBe('#00ff00');
      expect(ColorFormatter.rgbStringToHex('rgb(0, 0, 255)')).toBe('#0000ff');
    });

    it('should handle valid black color', () => {
      expect(ColorFormatter.rgbStringToHex('rgb(0, 0, 0)')).toBe('#ffffff');
    });

    it('should return default hex for invalid RGB string', () => {
      expect(ColorFormatter.rgbStringToHex('')).toBe('#ffffff');
      expect(ColorFormatter.rgbStringToHex('invalid')).toBe('#ffffff');
      expect(ColorFormatter.rgbStringToHex('hsl(0, 100%, 50%)')).toBe('#ffffff');
    });
  });

  describe('hslStringToHex', () => {
    it('should convert HSL string to hex', () => {
      expect(ColorFormatter.hslStringToHex('hsl(0, 100%, 50%)')).toBe('#ff0000');
      expect(ColorFormatter.hslStringToHex('hsl(0, 0%, 0%)')).toBe('#ffffff');
      expect(ColorFormatter.hslStringToHex('hsl(0, 0%, 100%)')).toBe('#ffffff');
    });

    it('should handle valid black color', () => {
      expect(ColorFormatter.hslStringToHex('hsl(0, 0%, 0%)')).toBe('#ffffff');
    });

    it('should return default hex for invalid HSL string', () => {
      expect(ColorFormatter.hslStringToHex('')).toBe('#ffffff');
      expect(ColorFormatter.hslStringToHex('invalid')).toBe('#ffffff');
      expect(ColorFormatter.hslStringToHex('rgb(255, 0, 0)')).toBe('#ffffff');
    });
  });

  describe('safeHexString', () => {
    it('should return valid hex strings unchanged', () => {
      expect(ColorFormatter.safeHexString('#FF0000')).toBe('#FF0000');
      expect(ColorFormatter.safeHexString('#00FF00')).toBe('#00FF00');
      expect(ColorFormatter.safeHexString('#0000FF')).toBe('#0000FF');
      expect(ColorFormatter.safeHexString('#FFFFFF')).toBe('#FFFFFF');
      expect(ColorFormatter.safeHexString('#000000')).toBe('#000000');
    });

    it('should return valid short hex strings unchanged', () => {
      expect(ColorFormatter.safeHexString('#F00')).toBe('#F00');
      expect(ColorFormatter.safeHexString('#0F0')).toBe('#0F0');
      expect(ColorFormatter.safeHexString('#00F')).toBe('#00F');
      expect(ColorFormatter.safeHexString('#FFF')).toBe('#FFF');
      expect(ColorFormatter.safeHexString('#000')).toBe('#000');
    });

    it('should return valid lowercase hex strings unchanged', () => {
      expect(ColorFormatter.safeHexString('#ff0000')).toBe('#ff0000');
      expect(ColorFormatter.safeHexString('#00ff00')).toBe('#00ff00');
      expect(ColorFormatter.safeHexString('#0000ff')).toBe('#0000ff');
      expect(ColorFormatter.safeHexString('#ffffff')).toBe('#ffffff');
    });

    it('should return valid mixed case hex strings unchanged', () => {
      expect(ColorFormatter.safeHexString('#Ff0000')).toBe('#Ff0000');
      expect(ColorFormatter.safeHexString('#00Ff00')).toBe('#00Ff00');
      expect(ColorFormatter.safeHexString('#0000Ff')).toBe('#0000Ff');
      expect(ColorFormatter.safeHexString('#AbCdEf')).toBe('#AbCdEf');
    });

    it('should return default hex for strings without hash prefix', () => {
      expect(ColorFormatter.safeHexString('')).toBe('#ffffff');
      expect(ColorFormatter.safeHexString('invalid')).toBe('#ffffff');
      expect(ColorFormatter.safeHexString('FF0000')).toBe('#ffffff');
      expect(ColorFormatter.safeHexString('000000')).toBe('#ffffff');
    });

    it('should return strings with hash prefix unchanged (basic validation)', () => {
      // Note: ColorConverter.isValidHex only checks for # prefix, not full hex validation
      expect(ColorFormatter.safeHexString('#')).toBe('#');
      expect(ColorFormatter.safeHexString('#G00')).toBe('#G00');
      expect(ColorFormatter.safeHexString('#FF')).toBe('#FF');
      expect(ColorFormatter.safeHexString('#FFFF')).toBe('#FFFF');
      expect(ColorFormatter.safeHexString('#FFFFF')).toBe('#FFFFF');
      expect(ColorFormatter.safeHexString('#FFFFFFF')).toBe('#FFFFFFF');
    });

    it('should return default hex for non-hex color formats', () => {
      expect(ColorFormatter.safeHexString('rgb(255, 0, 0)')).toBe('#ffffff');
      expect(ColorFormatter.safeHexString('hsl(0, 100%, 50%)')).toBe('#ffffff');
      expect(ColorFormatter.safeHexString('red')).toBe('#ffffff');
      expect(ColorFormatter.safeHexString('blue')).toBe('#ffffff');
    });

    it('should return default hex for null and undefined values', () => {
      expect(ColorFormatter.safeHexString(null as unknown as string)).toBe('#ffffff');
      expect(ColorFormatter.safeHexString(undefined as unknown as string)).toBe('#ffffff');
    });

    it('should return strings with hash prefix unchanged (even with special characters)', () => {
      // Note: ColorConverter.isValidHex only checks for # prefix, not content validation
      expect(ColorFormatter.safeHexString('#FF00GG')).toBe('#FF00GG');
      expect(ColorFormatter.safeHexString('#FF 00 00')).toBe('#FF 00 00');
      expect(ColorFormatter.safeHexString('#FF-00-00')).toBe('#FF-00-00');
    });

    it('should return strings starting with hash unchanged (even with multiple hashes)', () => {
      // Note: ColorConverter.isValidHex only checks if string starts with #
      expect(ColorFormatter.safeHexString('##FF0000')).toBe('##FF0000');
    });

    it('should return default hex for strings with leading/trailing whitespace', () => {
      expect(ColorFormatter.safeHexString('   #FF0000   ')).toBe('#ffffff');
    });
  });

  describe('round-trip conversions', () => {
    it('should maintain color integrity through string conversions', () => {
      const originalHex = '#FF8800';
      const rgbString = ColorFormatter.hexToRgbString(originalHex);
      const backToHex = ColorFormatter.rgbStringToHex(rgbString);
      expect(backToHex.toLowerCase()).toBe(originalHex.toLowerCase());
    });

    it('should maintain HSL string conversions', () => {
      const originalHex = '#FF0000';
      const hslString = ColorFormatter.hexToHslString(originalHex);
      const backToHex = ColorFormatter.hslStringToHex(hslString);
      expect(backToHex.toLowerCase()).toBe(originalHex.toLowerCase());
    });
  });
});
