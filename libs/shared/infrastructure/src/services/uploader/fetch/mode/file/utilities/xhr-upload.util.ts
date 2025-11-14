export const createXhrUploader = (onProgress: (progress: number) => void) => {
  return (url: string, blob: Blob): Promise<{ headers: { get: (name: string) => string | null } }> => {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded * 100) / event.total);
          onProgress(progress);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ headers: { get: (name: string) => xhr.getResponseHeader(name) } });
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}`));
        }
      });

      xhr.addEventListener('error', () => reject(new Error('Upload failed')));

      xhr.open('PUT', url);
      xhr.send(blob);
    });
  };
};
