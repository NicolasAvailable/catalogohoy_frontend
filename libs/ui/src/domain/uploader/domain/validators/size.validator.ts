import { convert, E } from '@shared/domain';
import { MaxSizeExceededError } from '../uploader.exception';

export const size = (file: File) => ({
  max: (max: { mb: number | undefined }) => {
    if (!max.mb || convert.byte(file.size).to.mb() <= max.mb) {
      return E.right(undefined);
    } else {
      return E.left(new MaxSizeExceededError(max.mb));
    }
  },
});
