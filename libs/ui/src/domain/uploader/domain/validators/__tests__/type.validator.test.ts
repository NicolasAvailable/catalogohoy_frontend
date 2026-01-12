import { type } from '../type.validator';
import { TypeNotAcceptedException } from '../../uploader.exception';
import { FileBuilder } from './file.builder';

describe('type validator', () => {
  describe('accept', () => {
    it('should return right(undefined) when accept is */*', () => {
      const file = FileBuilder.create().asJpeg().build();
      const result = type(file).accept('*/*');

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should return right(undefined) when accept is undefined', () => {
      const file = FileBuilder.create().asJpeg().build();
      const result = type(file).accept(undefined as any);

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should return right(undefined) when file type matches exactly', () => {
      const file = FileBuilder.create().asJpeg().build();
      const result = type(file).accept('image/jpeg');

      expect(result.isRight()).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should return right(undefined) when file type matches wildcard type', () => {
      const file = FileBuilder.create().asJpeg().build();
      const result = type(file).accept('image/*');

      expect(result.isRight()).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should return right(undefined) when file extension matches', () => {
      const file = FileBuilder.create().withMimeType('application/octet-stream').withName('test.pdf').build();
      const result = type(file).accept('.pdf');

      expect(result.isRight()).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should return left(TypeNotAcceptedException) when no types match', () => {
      const file = FileBuilder.create().asJpeg().build();
      const result = type(file).accept('application/pdf');

      expect(result.isLeft()).toBe(true);
      expect(result.value).toBeInstanceOf(TypeNotAcceptedException);
    });

    it('should handle multiple accepted types', () => {
      const file = FileBuilder.create().asPng().build();
      const result = type(file).accept('image/jpeg, image/png, application/pdf');

      expect(result.isRight()).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should be case insensitive', () => {
      const file = FileBuilder.create().withMimeType('IMAGE/JPEG').withName('TEST.JPG').build();
      const result = type(file).accept('image/jpeg');

      expect(result.isRight()).toBe(true);
      expect(result.value).toBeUndefined();
    });

    it('should trim whitespace from accepted types', () => {
      const file = FileBuilder.create().asJpeg().build();
      const result = type(file).accept(' image/jpeg ,  application/pdf  ');

      expect(result.isRight()).toBe(true);
      expect(result.value).toBeUndefined();
    });
  });
});
