import { E } from '../either/either.builder';

export type BaseUploaderOutput = {
  file: File;
  progress: () => number;
  complete: () => Promise<E.Either<Error, string>>;
};

export type BaseUploaderService = {
  fromFile(file: File): BaseUploaderOutput;
  fromUrl(url: string): Promise<E.Either<Error, string>>;
};
