import { BaseUploaderOutput, EntityList } from '@shared/domain';
import { Uploader } from './uploader.model';

export class UploaderList extends EntityList<Uploader> {
  constructor(uploaders: Uploader[]) {
    super(UploaderList, uploaders);
  }

  public get files() {
    return this.items.map(({ value }) => value.file);
  }

  public override get first() {
    return this.items[0] || Uploader.empty();
  }

  public get completed() {
    return this.filter((value) => value.progress === 100);
  }

  public get pending() {
    return this.filter((value) => value.progress < 100);
  }

  public get is() {
    const total = this.progress.total;
    return {
      completed: total === 100,
      uploading: total > 0 && total < 100,
      idle: total === 0,
    };
  }

  public get progress() {
    return {
      all: this.items.map((value) => value.progress),
      one: (index: number) => this.items[index].progress,
      total: Math.round(this.items.reduce((sum, value) => sum + value.progress, 0) / this.items.length),
      completed: this.items.filter((value) => value.progress === 100).length,
      pending: this.items.filter((value) => value.progress < 100).length,
    };
  }

  public static from(outputs: BaseUploaderOutput[]): UploaderList {
    return new UploaderList(outputs.map((output) => Uploader.from(output)));
  }

  public static idle(files: File[]) {
    return new UploaderList(files.map((file) => Uploader.idle(file)));
  }

  public static empty() {
    return new UploaderList([]);
  }
}
