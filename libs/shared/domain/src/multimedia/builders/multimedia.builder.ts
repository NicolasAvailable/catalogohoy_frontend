import { Multimedia } from '../multimedia';

export class MultimediaBuilder {
  private hasMetadata = true;
  private urls: string[] = [];

  public withoutMetadata() {
    this.hasMetadata = false;
    return this;
  }

  public loadMetadata() {
    this.hasMetadata = true;
    return this;
  }

  public withUrls(urls: string[]) {
    this.urls = urls;
    return this;
  }

  public build() {
    return this.urls.map((url) => Multimedia.from(url));
  }

  public static from(input: string[] | MultimediaBuilder) {
    if (input instanceof MultimediaBuilder) {
      return input;
    } else {
      return new MultimediaBuilder().withUrls(input);
    }
  }
}
