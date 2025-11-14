import { convert } from '../../converter/converter';

describe('convert', () => {
  describe('time conversions', () => {
    it('should convert seconds to milliseconds', () => {
      expect(convert.seg(1).to.ms()).toBe(1000);
      expect(convert.seg(2.5).to.ms()).toBe(2500);
      expect(convert.seg(0).to.ms()).toBe(0);
    });

    it('should convert milliseconds to seconds', () => {
      expect(convert.ms(1000).to.seg()).toBe(1);
      expect(convert.ms(2500).to.seg()).toBe(2.5);
      expect(convert.ms(0).to.seg()).toBe(0);
    });
  });

  describe('data size conversions', () => {
    it('should convert megabytes to bytes', () => {
      expect(convert.mb(1).to.byte()).toBe(1024 * 1024);
      expect(convert.mb(2.5).to.byte()).toBe(2.5 * 1024 * 1024);
      expect(convert.mb(0).to.byte()).toBe(0);
    });

    it('should convert kilobytes to megabytes', () => {
      expect(convert.kb(1024).to.mb()).toBe(1);
      expect(convert.kb(512).to.mb()).toBe(0.5);
      expect(convert.kb(0).to.mb()).toBe(0);
    });

    it('should convert bytes to megabytes', () => {
      expect(convert.byte(1024 * 1024).to.mb()).toBe(1);
      expect(convert.byte(512 * 1024).to.mb()).toBe(0.5);
      expect(convert.byte(0).to.mb()).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle negative numbers', () => {
      expect(convert.seg(-1).to.ms()).toBe(-1000);
      expect(convert.ms(-1000).to.seg()).toBe(-1);
      expect(convert.mb(-1).to.byte()).toBe(-1024 * 1024);
      expect(convert.kb(-1024).to.mb()).toBe(-1);
      expect(convert.byte(-1048576).to.mb()).toBe(-1);
    });

    it('should handle very large numbers', () => {
      const largeNumber = Number.MAX_SAFE_INTEGER / 2;
      expect(convert.seg(largeNumber).to.ms()).toBe(largeNumber * 1000);
      expect(convert.mb(largeNumber).to.byte()).toBe(largeNumber * 1024 * 1024);
    });
  });
});
