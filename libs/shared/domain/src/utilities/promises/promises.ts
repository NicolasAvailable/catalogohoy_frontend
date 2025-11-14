export const $promises = {
  onlySuccessful: <T>(promises: Promise<T>[]): Promise<Awaited<T>[]> => {
    return Promise.allSettled(promises).then((results) =>
      results
        .filter((result): result is PromiseFulfilledResult<Awaited<T>> => result.status === 'fulfilled')
        .map((result) => result.value)
    );
  },

  all: <T>(promises: Promise<T>[]): Promise<{ successes: Awaited<T>[]; errors: unknown[] }> => {
    return Promise.allSettled(promises).then((results) => {
      const successes: Awaited<T>[] = [];
      const errors: unknown[] = [];

      results.forEach((result) => {
        if (result.status === 'fulfilled') {
          successes.push(result.value);
        } else {
          errors.push(result.reason);
        }
      });

      return { successes, errors };
    });
  },
};
