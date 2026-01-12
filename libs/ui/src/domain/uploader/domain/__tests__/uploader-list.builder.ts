import { BaseUploaderOutput } from '@shared/domain';
import { UploaderList } from '../uploader-list.model';
import { Uploader } from '../uploader.model';
import { UploaderMother } from './uploader.builder';

export class UploaderListBuilder {
  private uploaders: Uploader[] = [];

  public withUploaders(uploaders: Uploader[]): UploaderListBuilder {
    this.uploaders = uploaders;
    return this;
  }

  public withUploader(uploader: Uploader): UploaderListBuilder {
    this.uploaders.push(uploader);
    return this;
  }

  public withIdleUploaders(count: number): UploaderListBuilder {
    for (let i = 0; i < count; i++) {
      this.uploaders.push(UploaderMother.idle());
    }
    return this;
  }

  public withUploadingUploaders(count: number): UploaderListBuilder {
    for (let i = 0; i < count; i++) {
      this.uploaders.push(UploaderMother.uploading(25 + (i * 25)));
    }
    return this;
  }

  public withCompletedUploaders(count: number): UploaderListBuilder {
    for (let i = 0; i < count; i++) {
      this.uploaders.push(UploaderMother.completed());
    }
    return this;
  }

  public withMixedProgress(): UploaderListBuilder {
    this.uploaders = [
      UploaderMother.idle(),
      UploaderMother.uploading(25),
      UploaderMother.uploading(75),
      UploaderMother.completed(),
    ];
    return this;
  }

  public asEmpty(): UploaderListBuilder {
    this.uploaders = [];
    return this;
  }

  public build(): UploaderList {
    return new UploaderList(this.uploaders);
  }
}

export class UploaderListMother {
  public static builder(): UploaderListBuilder {
    return new UploaderListBuilder();
  }

  public static empty(): UploaderList {
    return UploaderList.empty();
  }

  public static withSingleUploader(): UploaderList {
    return new UploaderListBuilder()
      .withUploader(UploaderMother.uploading())
      .build();
  }

  public static withMultipleUploaders(): UploaderList {
    return new UploaderListBuilder()
      .withMixedProgress()
      .build();
  }

  public static allCompleted(): UploaderList {
    return new UploaderListBuilder()
      .withCompletedUploaders(3)
      .build();
  }

  public static allIdle(): UploaderList {
    return new UploaderListBuilder()
      .withIdleUploaders(3)
      .build();
  }

  public static allUploading(): UploaderList {
    return new UploaderListBuilder()
      .withUploadingUploaders(3)
      .build();
  }

  public static fromOutputs(outputs: BaseUploaderOutput[]): UploaderList {
    return UploaderList.from(outputs);
  }
}
