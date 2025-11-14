import { E, $fetch } from '@shared/domain';
import { environment } from '@socialgest/env';

export class UrlUploaderService {
  public async from(url: string): Promise<E.Either<Error, string>> {
    const response = await $fetch.post('testvideo2_temp', { url }, { baseUrl: environment.apiUrlV1 });
    return E.right(response.data.imagelocation.location);
  }
}

export const urlUploaderService = new UrlUploaderService();
