import { jsPDF } from 'jspdf';

export const html = {
  create: {
    videoElement: {
      fromUrl: (url: string): Promise<HTMLVideoElement> => {
        return new Promise((resolve) => {
          const videoElement = document.createElement('video');
          videoElement.crossOrigin = 'anonymous';
          const source = document.createElement('source');
          source.src = url;
          source.type = 'video/mp4';
          videoElement.appendChild(source);
          videoElement.addEventListener('loadedmetadata', () => {
            videoElement.width = videoElement.videoWidth;
            videoElement.height = videoElement.videoHeight;
            resolve(videoElement);
          });
        });
      },
    },

    imageElement: {
      fromUrl: (url: string): Promise<HTMLImageElement> => {
        return new Promise((resolve) => {
          const image = new Image();
          image.crossOrigin = 'anonymous';
          image.onload = () => resolve(image);
          image.src = url;
        });
      },

      fromFile: (file: File) => {
        return html.create.imageElement.fromUrl(URL.createObjectURL(file));
      },
    },

    downloadLink: (blob: Blob, filename: string): void => {
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filename;

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      window.URL.revokeObjectURL(downloadUrl);
    },
  },

  to: {
    pdf: async (element: HTMLElement, name: string) => {
      const doc = new jsPDF('p', 'mm', 'a4');
      const pageWidth = doc.internal.pageSize.getWidth();
      const margins = { top: 10, bottom: 10, left: 10, right: 10 };
      const contentWidth = pageWidth - margins.left - margins.right;
      await doc.html(element, {
        callback: () => doc.save(name),
        margin: [margins.left, margins.top, margins.right, margins.bottom],
        width: contentWidth,
        windowWidth: element.scrollWidth,
      });
    },
  },
};
