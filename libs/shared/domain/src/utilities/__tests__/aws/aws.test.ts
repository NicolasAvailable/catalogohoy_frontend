import { aws } from '../../aws/aws';

describe('aws utility', () => {
  describe('parse', () => {
    it('should replace encoded image paths with forward slashes', () => {
      expect(aws.parse('test%2Fimages%2F123')).toBe('test/images/123');
      expect(aws.parse('test%252Fimages%252F123')).toBe('test/images/123');
    });

    it('should remove s3.amazonaws.com/ from URLs', () => {
      expect(aws.parse('https://s3.amazonaws.com/test-bucket/file')).toBe('https://test-bucket/file');
    });

    it('should handle multiple replacements in the same string', () => {
      const input = 'https://s3.amazonaws.com/test%2Fimages%2F123%2Ffile.jpg';
      expect(aws.parse(input)).toBe('https://test/images/123%2Ffile.jpg');
    });
  });

  describe('convert', () => {
    const prodUrl = 'https://prod-files.socialgest.net/test-bucket/file.jpg';
    const devUrl = 'https://dev-tempfiles.socialgest.net/test-bucket/file.jpg';
    const otherUrl = 'https://other-domain.com/test-bucket/file.jpg';

    it('should convert prod URL to s3.amazonaws.com format', () => {
      const expected = 'https://s3.amazonaws.com/prod-files.socialgest.net/test-bucket/file.jpg';
      expect(aws.convert(prodUrl)).toBe(expected);
    });

    it('should convert dev URL to s3.amazonaws.com format', () => {
      const expected = 'https://s3.amazonaws.com/dev-tempfiles.socialgest.net/test-bucket/file.jpg';
      expect(aws.convert(devUrl)).toBe(expected);
    });

    it('should not convert other URLs', () => {
      expect(aws.convert(otherUrl)).toBe(otherUrl);
    });
  });

  describe('is', () => {
    const prodUrl = 'https://prod-files.socialgest.net/test-bucket/file.jpg';
    const devUrl = 'https://dev-tempfiles.socialgest.net/test-bucket/file.jpg';
    const otherUrl = 'https://other-domain.com/test-bucket/file.jpg';

    describe('bucket', () => {
      it('should return true for prod bucket URLs', () => {
        expect(aws.is.bucket(prodUrl)).toBe(true);
      });

      it('should return true for dev bucket URLs', () => {
        expect(aws.is.bucket(devUrl)).toBe(true);
      });

      it('should return false for non-bucket URLs', () => {
        expect(aws.is.bucket(otherUrl)).toBe(false);
      });
    });

    describe('prod', () => {
      it('should return true for prod bucket URLs', () => {
        expect(aws.is.prod(prodUrl)).toBe(true);
      });

      it('should return false for dev bucket URLs', () => {
        expect(aws.is.prod(devUrl)).toBe(false);
      });

      it('should return false for non-bucket URLs', () => {
        expect(aws.is.prod(otherUrl)).toBe(false);
      });
    });
  });
});
