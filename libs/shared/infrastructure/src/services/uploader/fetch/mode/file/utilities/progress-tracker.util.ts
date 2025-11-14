export const createProgressTracker = () => {
  let fileUploadProgress: number[] = [];

  return {
    initialize: (partsCount: number) => {
      fileUploadProgress = new Array(partsCount).fill(0);
    },

    updatePart: (index: number, progress: number) => {
      fileUploadProgress[index] = progress;
    },

    getProgress: (): number => {
      if (fileUploadProgress.length === 0) return 0;

      let totalProgress = 0;

      fileUploadProgress.forEach((progress) => {
        totalProgress += progress / fileUploadProgress.length;
      });

      return Math.ceil(totalProgress);
    },
  };
};
