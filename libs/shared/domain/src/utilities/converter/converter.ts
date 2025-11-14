export const convert = {
  seg: (seconds: number) => {
    return {
      to: { ms: () => seconds * 1000 },
    };
  },

  ms: (milliseconds: number) => {
    return {
      to: { seg: () => milliseconds / 1000 },
    };
  },

  mb: (mb: number) => {
    return {
      to: { byte: () => mb * 1024 * 1024 },
    };
  },

  kb: (kb: number) => {
    return {
      to: { mb: () => kb / 1024 },
    };
  },

  byte: (byte: number) => {
    return {
      to: { mb: () => byte / 1024 / 1024 },
    };
  },
};
