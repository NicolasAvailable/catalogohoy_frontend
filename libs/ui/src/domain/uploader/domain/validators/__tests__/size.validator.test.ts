import { size } from '../size.validator';
import { MaxSizeExceededError } from '../../uploader.exception';
import { FileMother } from './file.builder';

describe('size validator', () => {
  describe('max', () => {
    it('should return right(undefined) when file size is less than max', () => {
      const file = FileMother.smallImage().build();
      const result = size(file).max({ mb: 2 });

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should return right(undefined) when file size equals max', () => {
      const file = FileMother.exactSize(2).build();
      const result = size(file).max({ mb: 2 });

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should return left(MaxSizeExceededError) when file size exceeds max', () => {
      const file = FileMother.largeImage().build();
      const result = size(file).max({ mb: 2 });

      expect(result.isLeft()).toBe(true);
      expect(result.isRight()).toBe(false);
      expect(result.value).toBeInstanceOf(MaxSizeExceededError);
    });

    it('should return right(undefined) when max is not specified', () => {
      const file = FileMother.smallImage().build();
      const result = size(file).max({ mb: undefined });

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.value).toBeUndefined();
    });

    it('should handle edge case of empty file', () => {
      const file = FileMother.emptyFile().build();
      const result = size(file).max({ mb: 1 });

      expect(result.isRight()).toBe(true);
      expect(result.isLeft()).toBe(false);
      expect(result.value).toBeUndefined();
    });
  });
});
