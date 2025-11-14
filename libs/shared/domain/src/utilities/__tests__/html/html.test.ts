import { html } from '../../html/html';

describe('html', () => {
  const mockCreateObjectURL = jest.fn();
  global.URL.createObjectURL = mockCreateObjectURL;
  global.URL.revokeObjectURL = jest.fn();

  beforeEach(() => {
    mockCreateObjectURL.mockClear();
    jest.clearAllMocks();
  });

  describe('createVideoElement', () => {
    it('should create a video element with the correct properties', async () => {
      const mockVideo = document.createElement('video');
      const mockSource = document.createElement('source');

      const createElementSpy = jest.spyOn(document, 'createElement');
      createElementSpy.mockImplementation((tagName) => {
        return tagName === 'video' ? mockVideo : mockSource;
      });

      Object.defineProperty(mockVideo, 'videoWidth', { value: 640 });
      Object.defineProperty(mockVideo, 'videoHeight', { value: 480 });

      const testUrl = 'https://example.com/video.mp4';
      const videoPromise = html.create.videoElement.fromUrl(testUrl);

      mockVideo.dispatchEvent(new Event('loadedmetadata'));

      const videoElement = await videoPromise;

      expect(videoElement).toBe(mockVideo);
      expect(videoElement.crossOrigin).toBe('anonymous');
      expect(videoElement.width).toBe(640);
      expect(videoElement.height).toBe(480);
      expect(videoElement.firstChild).toBe(mockSource);
      expect(mockSource.src).toBe(testUrl);
      expect(mockSource.type).toBe('video/mp4');

      createElementSpy.mockRestore();
    });
  });

  describe('createImageElement', () => {
    it('should create an image element with the correct properties', async () => {
      const testUrl = 'https://example.com/image.jpg';
      const mockImage = new Image();

      const originalImage = global.Image;
      (global as any).Image = jest.fn().mockImplementation(() => mockImage);

      const imagePromise = html.create.imageElement.fromUrl(testUrl);

      mockImage.onload?.({} as Event);

      const imageElement = await imagePromise;

      expect(imageElement).toBe(mockImage);
      expect(imageElement.crossOrigin).toBe('anonymous');
      expect(imageElement.src).toBe(testUrl);

      // Restore original Image
      global.Image = originalImage;
    });
  });

  describe('createImageFromFile', () => {
    it('should create an image from a file', async () => {
      const mockFile = new File(['test'], 'test.jpg', { type: 'image/jpeg' });
      const mockObjectUrl = 'blob:test-url';
      const mockImage = new Image();

      mockCreateObjectURL.mockReturnValue(mockObjectUrl);

      const originalImage = global.Image;
      (global as any).Image = jest.fn().mockImplementation(() => mockImage);

      const imagePromise = html.create.imageElement.fromFile(mockFile);

      mockImage.onload?.({} as Event);

      const imageElement = await imagePromise;

      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockFile);
      expect(imageElement.src).toBe(mockObjectUrl);

      global.Image = originalImage;
    });
  });

  describe('downloadLink', () => {
    let mockLink: HTMLAnchorElement;
    let appendChildSpy: jest.SpyInstance;
    let removeChildSpy: jest.SpyInstance;
    let clickSpy: jest.SpyInstance;

    beforeEach(() => {
      mockLink = document.createElement('a');
      clickSpy = jest.spyOn(mockLink, 'click').mockImplementation();
      
      const createElementSpy = jest.spyOn(document, 'createElement');
      createElementSpy.mockImplementation((tagName) => {
        return tagName === 'a' ? mockLink : document.createElement(tagName);
      });

      appendChildSpy = jest.spyOn(document.body, 'appendChild').mockImplementation();
      removeChildSpy = jest.spyOn(document.body, 'removeChild').mockImplementation();
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('should create and trigger download link with correct properties', () => {
      const mockBlob = new Blob(['test content'], { type: 'text/plain' });
      const mockObjectUrl = 'blob:test-download-url';
      const filename = 'test-file.txt';

      mockCreateObjectURL.mockReturnValue(mockObjectUrl);

      html.create.downloadLink(mockBlob, filename);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockLink.href).toBe(mockObjectUrl);
      expect(mockLink.download).toBe(filename);
      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(clickSpy).toHaveBeenCalled();
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
    });

    it('should handle different blob types', () => {
      const mockBlob = new Blob(['{"test": "data"}'], { type: 'application/json' });
      const mockObjectUrl = 'blob:json-url';
      const filename = 'data.json';

      mockCreateObjectURL.mockReturnValue(mockObjectUrl);

      html.create.downloadLink(mockBlob, filename);

      expect(mockCreateObjectURL).toHaveBeenCalledWith(mockBlob);
      expect(mockLink.href).toBe(mockObjectUrl);
      expect(mockLink.download).toBe(filename);
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should handle empty filename', () => {
      const mockBlob = new Blob(['test'], { type: 'text/plain' });
      const mockObjectUrl = 'blob:empty-filename-url';
      const filename = '';

      mockCreateObjectURL.mockReturnValue(mockObjectUrl);

      html.create.downloadLink(mockBlob, filename);

      expect(mockLink.download).toBe('');
      expect(clickSpy).toHaveBeenCalled();
    });

    it('should clean up resources after download', () => {
      const mockBlob = new Blob(['cleanup test'], { type: 'text/plain' });
      const mockObjectUrl = 'blob:cleanup-url';
      const filename = 'cleanup.txt';

      mockCreateObjectURL.mockReturnValue(mockObjectUrl);

      html.create.downloadLink(mockBlob, filename);

      expect(appendChildSpy).toHaveBeenCalledWith(mockLink);
      expect(removeChildSpy).toHaveBeenCalledWith(mockLink);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith(mockObjectUrl);
    });
  });
});
