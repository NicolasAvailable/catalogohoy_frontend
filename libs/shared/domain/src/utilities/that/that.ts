export const that = <T>(item: T) => ({
  or: (fallback: T) => (item ?? fallback) as T,
});
