import { $promises } from '@shared/domain';
import { uploaderService } from '../uploader.service';

export class UrlUploaderBuilder {
  private readonly urls: string[] = [];

  public many(urls: string[]) {
    this.urls.push(...urls);
    return this;
  }

  public async complete(): Promise<string[]> {
    const promises = this.urls.map(async (url) => await uploaderService.fromUrl(url));
    return (await $promises.onlySuccessful(promises)).map((result) => result.value as string);
  }
}

export const urlUploaderBuilder = () => new UrlUploaderBuilder();
