export type Filtrable<T, K> = {
  filter(users: T): K;
};
