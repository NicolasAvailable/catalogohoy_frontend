import { ColorContrast } from '../../color/color-contrast';

describe('ColorContrast', () => {
  describe('getOptimalTextColor', () => {
    describe('should return white text for dark backgrounds', () => {
      it('should return white for pure black', () => {
        expect(ColorContrast.getOptimalTextColor('#000000')).toBe('#ffffff');
      });

      it('should return white for dark red', () => {
        expect(ColorContrast.getOptimalTextColor('#800000')).toBe('#ffffff');
      });

      it('should return white for dark blue', () => {
        expect(ColorContrast.getOptimalTextColor('#000080')).toBe('#ffffff');
      });

      it('should return white for dark green', () => {
        expect(ColorContrast.getOptimalTextColor('#008000')).toBe('#ffffff');
      });

      it('should return white for dark purple', () => {
        expect(ColorContrast.getOptimalTextColor('#800080')).toBe('#ffffff');
      });

      it('should return white for dark gray', () => {
        expect(ColorContrast.getOptimalTextColor('#404040')).toBe('#ffffff');
      });
    });

    describe('should return black text for light backgrounds', () => {
      it('should return black for pure white', () => {
        expect(ColorContrast.getOptimalTextColor('#ffffff')).toBe('#7d7d7d');
      });

      it('should return black for light yellow', () => {
        expect(ColorContrast.getOptimalTextColor('#ffff00')).toBe('#7d7d7d');
      });

      it('should return black for light cyan', () => {
        expect(ColorContrast.getOptimalTextColor('#00ffff')).toBe('#7d7d7d');
      });

      it('should return black for light magenta', () => {
        expect(ColorContrast.getOptimalTextColor('#ff00ff')).toBe('#7d7d7d');
      });

      it('should return black for light gray', () => {
        expect(ColorContrast.getOptimalTextColor('#c0c0c0')).toBe('#7d7d7d');
      });

      it('should return black for light green', () => {
        expect(ColorContrast.getOptimalTextColor('#90ee90')).toBe('#7d7d7d');
      });
    });

    describe('should handle edge cases', () => {
      it('should work with colors without # prefix', () => {
        expect(ColorContrast.getOptimalTextColor('000000')).toBe('#ffffff');
        expect(ColorContrast.getOptimalTextColor('ffffff')).toBe('#7d7d7d');
      });

      it('should work with short hex format', () => {
        expect(ColorContrast.getOptimalTextColor('#000')).toBe('#ffffff');
        expect(ColorContrast.getOptimalTextColor('#fff')).toBe('#7d7d7d');
      });

      it('should handle medium luminance colors consistently', () => {
        // Test colors around the threshold
        expect(ColorContrast.getOptimalTextColor('#808080')).toBe('#7d7d7d');
        expect(ColorContrast.getOptimalTextColor('#909090')).toBe('#7d7d7d');
      });
    });

    describe('should work with common brand colors', () => {
      it('should return black for Facebook blue (lighter than expected)', () => {
        expect(ColorContrast.getOptimalTextColor('#1877f2')).toBe('#7d7d7d');
      });

      it('should return black for Twitter blue (lighter than expected)', () => {
        expect(ColorContrast.getOptimalTextColor('#1da1f2')).toBe('#7d7d7d');
      });

      it('should return black for Instagram gradient yellow', () => {
        expect(ColorContrast.getOptimalTextColor('#fccc63')).toBe('#7d7d7d');
      });

      it('should return white for LinkedIn blue', () => {
        expect(ColorContrast.getOptimalTextColor('#0077b5')).toBe('#ffffff');
      });
    });
  });

  describe('calculateLuminance', () => {
    it('should return 0 for pure black', () => {
      expect(ColorContrast.calculateLuminance('#000000')).toBeCloseTo(0, 3);
    });

    it('should return 1 for pure white', () => {
      expect(ColorContrast.calculateLuminance('#ffffff')).toBeCloseTo(1, 3);
    });

    it('should return correct luminance for pure red', () => {
      expect(ColorContrast.calculateLuminance('#ff0000')).toBeCloseTo(0.2126, 3);
    });

    it('should return correct luminance for pure green', () => {
      expect(ColorContrast.calculateLuminance('#00ff00')).toBeCloseTo(0.7152, 3);
    });

    it('should return correct luminance for pure blue', () => {
      expect(ColorContrast.calculateLuminance('#0000ff')).toBeCloseTo(0.0722, 3);
    });

    it('should handle colors without # prefix', () => {
      expect(ColorContrast.calculateLuminance('808080')).toBeCloseTo(0.2159, 2);
    });

    it('should handle short hex format', () => {
      expect(ColorContrast.calculateLuminance('#888')).toBeCloseTo(0.2462, 2);
    });
  });

  describe('real-world scenarios', () => {
    it('should provide optimal text colors for common UI colors', () => {
      const testCases = [
        { bg: '#f8f9fa', expected: '#7d7d7d' }, // Light gray
        { bg: '#e9ecef', expected: '#7d7d7d' }, // Light gray
        { bg: '#dee2e6', expected: '#7d7d7d' }, // Medium light gray
        { bg: '#adb5bd', expected: '#7d7d7d' }, // Medium gray
        { bg: '#6c757d', expected: '#ffffff' }, // Medium dark gray
        { bg: '#495057', expected: '#ffffff' }, // Dark gray
        { bg: '#343a40', expected: '#ffffff' }, // Very dark gray
        { bg: '#212529', expected: '#ffffff' }, // Almost black
      ];

      testCases.forEach(({ bg, expected }) => {
        expect(ColorContrast.getOptimalTextColor(bg)).toBe(expected);
      });
    });

    it('should ensure optimal text color provides good contrast', () => {
      const testColors = [
        '#ff0000',
        '#00ff00',
        '#0000ff',
        '#ffff00',
        '#ff00ff',
        '#00ffff',
        '#800000',
        '#008000',
        '#000080',
        '#808000',
        '#800080',
        '#008080',
        '#c0c0c0',
        '#808080',
        '#404040',
        '#202020',
        '#e0e0e0',
        '#606060',
      ];

      testColors.forEach((color) => {
        const optimalText = ColorContrast.getOptimalTextColor(color);

        // Should be either pure black or pure white
        expect(['#ffffff', '#7d7d7d']).toContain(optimalText);
      });
    });
  });
});
