import { IdFactory } from '../../factory/id';
import { blobConverter } from '../blob/blob';
import { html } from '../html/html';

export const $url = {
  to: {
    async file(url: string): Promise<File> {
      const res: Response = await fetch(url);
      const blob: Blob = await res.blob();
      return new File([blob], IdFactory.create(), { type: blob.type });
    },

    async base64(url: string): Promise<string> {
      const data = await fetch(url);
      const blob = await data.blob();
      return blobConverter.toBase64(blob);
    },
  },

  from: {
    async file(file: File): Promise<string> {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function () {
          resolve(reader.result as string);
        };
      });
    },
  },

  download: async (url: string, filename?: string): Promise<void> => {
    const response = await fetch(url);
    const blob = await response.blob();
    html.create.downloadLink(blob, filename || url.split('/').pop() || 'download');
  },
};
