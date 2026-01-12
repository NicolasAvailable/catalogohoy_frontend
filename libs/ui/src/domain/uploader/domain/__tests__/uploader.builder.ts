import { E, BaseUploaderOutput } from '@shared/domain';
import { FileMother } from '../validators/__tests__/file.builder';
import { Uploader } from '../uploader.model';

export class UploaderBuilder {
  private file: File = FileMother.smallImage().build();
  private progressValue: number = 0;
  private completeResult: E.Either<Error, string> = E.right('https://example.com/file.jpg');

  public withFile(file: File): UploaderBuilder {
    this.file = file;
    return this;
  }

  public withProgress(progress: number): UploaderBuilder {
    this.progressValue = progress;
    return this;
  }

  public withCompleteResult(result: E.Either<Error, string>): UploaderBuilder {
    this.completeResult = result;
    return this;
  }

  public withCompleteSuccess(url: string): UploaderBuilder {
    this.completeResult = E.right(url);
    return this;
  }

  public withCompleteError(error: Error): UploaderBuilder {
    this.completeResult = E.left(error);
    return this;
  }

  public asIdle(): UploaderBuilder {
    this.progressValue = 0;
    return this;
  }

  public asUploading(progress: number = 50): UploaderBuilder {
    this.progressValue = Math.max(1, Math.min(99, progress));
    return this;
  }

  public asCompleted(): UploaderBuilder {
    this.progressValue = 100;
    return this;
  }

  public build(): Uploader {
    const output: BaseUploaderOutput = {
      file: this.file,
      progress: () => this.progressValue,
      complete: () => Promise.resolve(this.completeResult),
    };
    return Uploader.from(output);
  }
}

export class UploaderMother {
  public static builder(): UploaderBuilder {
    return new UploaderBuilder();
  }

  public static idle(): Uploader {
    return new UploaderBuilder().asIdle().build();
  }

  public static uploading(progress: number = 50): Uploader {
    return new UploaderBuilder().asUploading(progress).build();
  }

  public static completed(): Uploader {
    return new UploaderBuilder().asCompleted().build();
  }

  public static withFile(file: File): Uploader {
    return new UploaderBuilder().withFile(file).build();
  }

  public static withProgress(progress: number): Uploader {
    return new UploaderBuilder().withProgress(progress).build();
  }

  public static withError(error: Error): Uploader {
    return new UploaderBuilder().withCompleteError(error).build();
  }

  public static imageUploader(): Uploader {
    return new UploaderBuilder().withFile(FileMother.smallImage().build()).asUploading(75).build();
  }

  public static pdfUploader(): Uploader {
    return new UploaderBuilder().withFile(FileMother.pdfDocument().build()).asCompleted().build();
  }

  public static failedUploader(): Uploader {
    return new UploaderBuilder().withCompleteError(new Error('Upload failed')).asIdle().build();
  }
}
