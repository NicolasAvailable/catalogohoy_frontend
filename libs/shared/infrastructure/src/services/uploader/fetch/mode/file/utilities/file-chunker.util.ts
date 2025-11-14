import { convert } from '@shared/domain';

const MAX_SIZE = convert.mb(10).to.byte();

export const createFileChunker = () => {
  return {
    getChunks: (file: File, urls: string[]) => {
      const keys = Object.keys(urls);
      return keys.map((indexStr) => {
        const index = parseInt(indexStr);
        const start = index * MAX_SIZE;
        const end = (index + 1) * MAX_SIZE;
        const blob = index < keys.length ? file.slice(start, end) : file.slice(start);

        return { index, blob, url: urls[index] };
      });
    },
  };
};
