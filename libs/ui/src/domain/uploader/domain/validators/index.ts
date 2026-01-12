import { assert, boolean, E, EitherBuilder, Exception } from '@shared/domain';
import { size } from './size.validator';
import { type } from './type.validator';

type ValidatorInput = { accept: string; max: { mb: number | undefined } };
class FileValidator {
  private values: ValidatorInput = { accept: '', max: { mb: undefined } };

  public accept(accept: string): this {
    this.values.accept = accept;
    return this;
  }

  public max(mb: number | undefined): this {
    this.values.max.mb = mb;
    return this;
  }

  public file(file: File): E.Either<Exception, void> {
    assert(boolean(this.values.accept), 'accept is required');
    const result = E.merge([size(file).max(this.values.max), type(file).accept(this.values.accept)]);
    return new EitherBuilder<Exception, void>().fromEitherToEither(result).build();
  }

  public files(files: File[]): E.Either<Exception, void> {
    return files.map((file) => this.file(file)).find((result) => result.isLeft()) ?? E.right(undefined);
  }
}

export const validator = () => new FileValidator();
