import { $url } from '@shared/domain';
import { uploaderService } from '../uploader.service';

export class FileUploaderBuilder {
  private readonly files: File[] = [];

  public async many(urls: string[]) {
    for (const url of urls) {
      this.files.push(await $url.to.file(url));
    }
    return this;
  }

  public async complete(): Promise<string[]> {
    const promises = this.files.map(async (file) => await uploaderService.fromFile(file));
    const urls: string[] = [];
    for (const result of await Promise.all(promises)) {
      urls.push((await result.complete()).value as string);
    }
    return urls;
  }
}

export const fileUploaderBuilder = () => new FileUploaderBuilder();
