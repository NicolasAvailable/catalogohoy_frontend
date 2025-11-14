import { IdFactory } from '../../factory/id';

export const $file = {
  type: {
    get: (file: File): string => {
      if (file.type) {
        return file.type;
      } else if (file.name.split('.').pop() === 'mov') {
        return 'video/quicktime';
      } else {
        return 'video/mp4';
      }
    },
  },

  ext: {
    has: function (file: File): boolean {
      return !!this.get(file);
    },

    get: (file: File): string | null => {
      const ext = file.name?.split('.');
      return !ext || ext?.length <= 1 ? null : (ext.pop() as string);
    },
  },

  from: {
    url: async function (dataUrl: string): Promise<File> {
      const res: Response = await fetch(dataUrl);
      const blob: Blob = await res.blob();
      return this.blob(blob, blob.type);
    },

    blob: (blob: Blob, format = 'image/jpg', fileName: string = IdFactory.create()) => {
      return new File([blob], fileName, { type: format });
    },
  },
};
