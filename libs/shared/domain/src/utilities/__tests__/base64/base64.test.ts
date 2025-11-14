import { base64 } from '../../base64/base64';

describe('base64 utilities', () => {
  describe('from.arrayBuffer', () => {
    it('should convert empty ArrayBuffer to base64', () => {
      const buffer = new ArrayBuffer(0);
      const result = base64.from.arrayBuffer(buffer);
      expect(result).toBe('');
    });

    it('should convert single byte ArrayBuffer to base64', () => {
      const buffer = new ArrayBuffer(1);
      const view = new Uint8Array(buffer);
      view[0] = 65; // ASCII 'A'
      
      const result = base64.from.arrayBuffer(buffer);
      expect(result).toBe('QQ==');
    });

    it('should convert multiple bytes ArrayBuffer to base64', () => {
      const buffer = new ArrayBuffer(3);
      const view = new Uint8Array(buffer);
      view[0] = 65; // 'A'
      view[1] = 66; // 'B'
      view[2] = 67; // 'C'
      
      const result = base64.from.arrayBuffer(buffer);
      expect(result).toBe('QUJD');
    });

    it('should convert text data to base64', () => {
      const text = 'Hello World';
      const buffer = new TextEncoder().encode(text).buffer;
      
      const result = base64.from.arrayBuffer(buffer);
      const expected = btoa(text);
      expect(result).toBe(expected);
    });

    it('should handle binary data correctly', () => {
      const buffer = new ArrayBuffer(4);
      const view = new Uint8Array(buffer);
      view[0] = 0x00;
      view[1] = 0xFF;
      view[2] = 0x80;
      view[3] = 0x7F;
      
      const result = base64.from.arrayBuffer(buffer);
      expect(result).toBe('AP+Afw==');
    });

    it('should handle large ArrayBuffer', () => {
      const size = 1024;
      const buffer = new ArrayBuffer(size);
      const view = new Uint8Array(buffer);
      
      // Fill with pattern
      for (let i = 0; i < size; i++) {
        view[i] = i % 256;
      }
      
      const result = base64.from.arrayBuffer(buffer);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
      expect(typeof result).toBe('string');
    });

    it('should produce same result as btoa for ASCII text', () => {
      const testStrings = ['test', 'hello', 'world', '123', 'ABC'];
      
      testStrings.forEach(text => {
        const buffer = new TextEncoder().encode(text).buffer;
        const result = base64.from.arrayBuffer(buffer);
        const expected = btoa(text);
        expect(result).toBe(expected);
      });
    });

    it('should handle special characters', () => {
      const buffer = new ArrayBuffer(6);
      const view = new Uint8Array(buffer);
      view[0] = 0x21; // '!'
      view[1] = 0x40; // '@'
      view[2] = 0x23; // '#'
      view[3] = 0x24; // '$'
      view[4] = 0x25; // '%'
      view[5] = 0x5E; // '^'
      
      const result = base64.from.arrayBuffer(buffer);
      expect(result).toBe('IUAjJCVe');
    });

    it('should handle ArrayBuffer with different byte lengths', () => {
      // Test different lengths to ensure padding works correctly
      const lengths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      
      lengths.forEach(length => {
        const buffer = new ArrayBuffer(length);
        const view = new Uint8Array(buffer);
        
        // Fill with incremental values
        for (let i = 0; i < length; i++) {
          view[i] = i + 1;
        }
        
        const result = base64.from.arrayBuffer(buffer);
        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
        expect(result.length).toBeGreaterThan(0);
      });
    });

    it('should handle ArrayBuffer created from different sources', () => {
      // From Uint8Array
      const uint8Array = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
      const result1 = base64.from.arrayBuffer(uint8Array.buffer);
      
      // From Int8Array
      const int8Array = new Int8Array([72, 101, 108, 108, 111]); // "Hello"
      const result2 = base64.from.arrayBuffer(int8Array.buffer);
      
      expect(result1).toBe(result2);
      expect(result1).toBe('SGVsbG8=');
    });
  });
});
