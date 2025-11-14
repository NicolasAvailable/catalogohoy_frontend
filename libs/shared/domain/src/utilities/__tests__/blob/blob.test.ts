import { blobConverter } from '../../blob/blob';

describe('blobConverter', () => {
  describe('toBase64', () => {
    it('should convert a Blob to a base64 string', async () => {
      const testText = 'Hello, world!';
      const blob = new Blob([testText], { type: 'text/plain' });

      const base64 = await blobConverter.toBase64(blob);

      expect(base64).toMatch(/^data:text\/plain;base64,[a-zA-Z0-9+/=]+$/);

      const decoded = atob(base64.split(',')[1]);
      expect(decoded).toBe(testText);
    });

    it('should handle empty blobs', async () => {
      const emptyBlob = new Blob([], { type: 'text/plain' });
      const base64 = await blobConverter.toBase64(emptyBlob);
      expect(base64).toMatch(/^data:text\/plain;base64,?$/);
    });

    it('should preserve the content type', async () => {
      const jsonBlob = new Blob(['{"key":"value"}'], { type: 'application/json' });
      const base64 = await blobConverter.toBase64(jsonBlob);
      expect(base64).toMatch(/^data:application\/json;base64,/);
    });
  });
});
