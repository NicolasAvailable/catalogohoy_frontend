export const sleep = (ms = 0, props: { when: boolean } = { when: true }) => {
  return new Promise((resolve) => setTimeout(resolve, props.when ? ms : 0));
};

export const trigger = <T = void>(fn: () => T) => {
  const result = fn();
  return {
    sleep: (ms: number) => sleep(ms).then(() => result),
  };
};
