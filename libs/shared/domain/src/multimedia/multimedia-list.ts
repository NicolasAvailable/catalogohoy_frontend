import { EntityList } from '@shared/domain';
import { MultimediaBuilder } from './builders/multimedia.builder';
import { Multimedia } from './multimedia';

export class MultimediaList extends EntityList<Multimedia> {
  constructor(multimedia: Multimedia[]) {
    super(MultimediaList, multimedia);
  }

  public override get has() {
    return {
      ...super.has,
      all: {
        image: this.items.every((multimedia) => multimedia.isImage()),
        gif: this.items.every((multimedia) => multimedia.isGif()),
        document: this.items.every((multimedia) => multimedia.isDocument()),
        video: this.items.every((multimedia) => multimedia.isVideo()),
        pdf: this.items.every((multimedia) => multimedia.isPdf()),
      },
      some: {
        image: this.items.some((multimedia) => multimedia.isImage()),
        gif: this.items.some((multimedia) => multimedia.isGif()),
        document: this.items.some((multimedia) => multimedia.isDocument()),
        video: this.items.some((multimedia) => multimedia.isVideo()),
        pdf: this.items.some((multimedia) => multimedia.isPdf()),
        audio: this.items.some((multimedia) => multimedia.isAudio()),
        multimedia: (multimedia: Multimedia) => this.items.some((m) => m.isOther(multimedia)),
      },
    };
  }

  public get images(): MultimediaList {
    return this.filter((multimedia) => multimedia.isImage());
  }

  public get videos(): MultimediaList {
    return this.filter((multimedia) => multimedia.isVideo());
  }

  public get gifs(): MultimediaList {
    return this.filter((multimedia) => multimedia.isGif());
  }

  public get documents(): MultimediaList {
    return this.filter((multimedia) => multimedia.isDocument());
  }

  public get ok(): MultimediaList {
    return this.filter((multimedia) => multimedia.isOk());
  }

  public get error(): MultimediaList {
    return this.filter((multimedia) => multimedia.isError());
  }

  public get loading(): MultimediaList {
    return this.filter((multimedia) => multimedia.isLoading());
  }

  public get totalSize(): number {
    return this.items.reduce((total, m) => total + m.size, 0);
  }

  public get search() {
    return {
      url: (url: string) => this.items.find((m) => m.isEqual(url)),
      multimedia: (multimedia: Multimedia) => this.items.find((m) => m.isOther(multimedia)),
    };
  }

  public get findIndex() {
    return {
      multimedia: (multimedia: Multimedia) => this.items.findIndex((m) => m.isEqual(multimedia.url)),
    };
  }

  public get tail() {
    return {
      video: this.videos.items[this.videos.items.length - 1],
      image: this.images.items[this.images.items.length - 1],
      gif: this.gifs.items[this.gifs.items.length - 1],
      document: this.documents.items[this.documents.items.length - 1],
      element: this.items[this.items.length - 1],
    };
  }

  public get is() {
    return {
      carousel: this.items.length > 1,
      totalSizeGreaterThan: (size: number) => this.totalSize > size,
      durationGreaterThan: (d: number) => this.items.some((multimedia) => multimedia.isDurationGreaterThan(d)),
      equal: (multimedia: Multimedia[]) => multimedia.every((m) => this.has.some.multimedia(m)),
    };
  }

  public insert(urls: string | string[]) {
    [urls]
      .flat()
      .map((url) => Multimedia.from(url).loadMetadata())
      .forEach((m) => this.mutable.insert(m));
  }

  public ensure(predicate: (m: Multimedia) => boolean) {
    return this.items.map((m) => m.ensure(predicate)).every((ok) => ok);
  }

  public ensureAsError(predicate: (m: Multimedia) => boolean) {
    return this.items.map((m) => m.ensureAsError(predicate)).every((ok) => ok);
  }

  public markAllAsOk() {
    return this.items.map((m) => m.to.ok());
  }

  public static from(multimedia: Multimedia[]) {
    return new MultimediaList(multimedia);
  }

  public static primitives(input: string[] | MultimediaBuilder) {
    return new MultimediaList(MultimediaBuilder.from(input).build());
  }

  public static empty(): MultimediaList {
    return new MultimediaList([]);
  }
}

export type MultimediaPrimitives = {
  multimedia: string[];
};
