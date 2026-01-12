import { E } from '@shared/domain';
import { TypeNotAcceptedException } from '../uploader.exception';

export const type = (file: File) => ({
  accept: (accept: string) => {
    if (isAccepted(file, accept)) {
      return E.right(undefined);
    } else {
      return E.left(new TypeNotAcceptedException());
    }
  },
});

const isAccepted = (file: File, accept: string): boolean => {
  if (!accept || accept === '*/*') return true;

  const fileType = file.type.toLowerCase();
  const fileName = file.name.toLowerCase();
  const acceptedTypes = accept.split(',').map((type) => type.trim().toLowerCase());

  return acceptedTypes.some((acceptedType) => {
    if (fileType === acceptedType) {
      return true;
    }

    if (acceptedType.endsWith('/*')) {
      const baseType = acceptedType.slice(0, -2);
      return fileType.startsWith(`${baseType}/`);
    }

    if (acceptedType.startsWith('.')) {
      return fileName.endsWith(acceptedType);
    }

    return false;
  });
};
