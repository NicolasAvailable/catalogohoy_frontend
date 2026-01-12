import { BaseUploaderOutput, E, Entity } from '@shared/domain';

export class Uploader extends Entity {
  private constructor(public readonly value: BaseUploaderOutput) {
    super();
  }

  public get file() {
    return this.value.file;
  }

  public get progress() {
    return this.value.progress();
  }

  public complete() {
    return this.value.complete();
  }

  public get is() {
    return {
      completed: this.progress === 100,
      uploading: this.progress > 0 && this.progress < 100,
      idle: this.progress === 0,
    };
  }

  public static empty() {
    return Uploader.idle(undefined as unknown as File);
  }

  public static from(output: BaseUploaderOutput) {
    return new Uploader(output);
  }

  public static idle(file: File) {
    return new Uploader({ file, progress: () => 0, complete: () => Promise.resolve(E.right('')) });
  }
}
