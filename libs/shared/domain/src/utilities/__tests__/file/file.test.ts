import { $file } from '../../file/file';

describe('$file', () => {
  describe('type', () => {
    it('should return the file type if it exists', () => {
      const file = new File(['test'], 'test.txt', { type: 'text/plain' });
      expect($file.type.get(file)).toBe('text/plain');
    });

    it('should return video/quicktime for .mov files when type is not specified', () => {
      const file = new File(['test'], 'test.mov', { type: '' });
      expect($file.type.get(file)).toBe('video/quicktime');
    });

    it('should return video/mp4 for other files when type is not specified', () => {
      const file = new File(['test'], 'test.unknown', { type: '' });
      expect($file.type.get(file)).toBe('video/mp4');
    });
  });

  describe('ext', () => {
    describe('has', () => {
      it('should return true for files with an extension', () => {
        const file = new File(['test'], 'test.txt');
        expect($file.ext.has(file)).toBe(true);
      });

      it('should return false for files without an extension', () => {
        const file = new File(['test'], 'test');
        expect($file.ext.has(file)).toBe(false);
      });
    });

    describe('get', () => {
      it('should return the file extension', () => {
        const file = new File(['test'], 'test.txt');
        expect($file.ext.get(file)).toBe('txt');
      });

      it('should return null for files without an extension', () => {
        const file = new File(['test'], 'test');
        expect($file.ext.get(file)).toBeNull();
      });

      it('should handle filenames with multiple dots', () => {
        const file = new File(['test'], 'test.file.txt');
        expect($file.ext.get(file)).toBe('txt');
      });
    });
  });

  describe('from', () => {
    describe('url', () => {
      global.fetch = jest.fn();
      const mockBlob = new Blob(['test'], { type: 'text/plain' });

      beforeEach(() => {
        (global.fetch as jest.Mock).mockResolvedValue({
          blob: () => Promise.resolve(mockBlob),
        });
      });

      afterEach(() => {
        jest.clearAllMocks();
      });

      it('should create a file from a URL', async () => {
        const url = 'https://example.com/test.txt';
        const file = await $file.from.url(url);

        expect(global.fetch).toHaveBeenCalledWith(url);
        expect(file).toBeInstanceOf(File);
        expect(file.type).toBe('text/plain');
      });
    });

    describe('blob', () => {
      it('should create a file from a blob', () => {
        const blob = new Blob(['test'], { type: 'text/plain' });
        const file = $file.from.blob(blob, 'text/plain', 'test.txt');

        expect(file).toBeInstanceOf(File);
        expect(file.name).toBe('test.txt');
        expect(file.type).toBe('text/plain');
        expect(file.size).toBe(blob.size);
      });

      it('should use default values when not provided', () => {
        const blob = new Blob(['test']);
        const file = $file.from.blob(blob);

        expect(file.name).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
        expect(file.type).toBe('image/jpg');
      });
    });
  });
});
