import { createProgressTracker, createXhrUploader, createFileChunker } from './utilities';

export type MultipartOutput = { ETag: string; PartNumber: number };

export type FilePartService = {
  getProgress: () => number;
  uploadFileMultipart: (file: File, urls: string[]) => Promise<MultipartOutput[]>;
};

export const createFilePartService = (): FilePartService => {
  const progressTracker = createProgressTracker();
  const fileChunker = createFileChunker();

  return {
    getProgress: () => progressTracker.getProgress(),
    uploadFileMultipart: async (file: File, urls: string[]): Promise<MultipartOutput[]> => {
      const chunks = fileChunker.getChunks(file, urls);
      progressTracker.initialize(chunks.length);

      const uploadPromises = chunks.map(({ index, blob, url }) => {
        const uploader = createXhrUploader((progress) => progressTracker.updatePart(index, progress));
        return uploader(url, blob);
      });

      const parts = await Promise.all(uploadPromises);
      return parts.map((part, index) => ({
        ETag: JSON.parse(part.headers.get('etag') || '""'),
        PartNumber: index + 1,
      }));
    },
  };
};
