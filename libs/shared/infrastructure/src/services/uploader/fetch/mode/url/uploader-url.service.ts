import { environment } from '@catalogohoy/env';
import { $fetch, E } from '@shared/domain';

export class UrlUploaderService {
  public async from(url: string): Promise<E.Either<Error, string>> {
    const response = await $fetch.post(
      'testvideo2_temp',
      { url },
      { baseUrl: environment.apiUrl }
    );
    return E.right(response.data.imagelocation.location);
  }
}

export const urlUploaderService = new UrlUploaderService();
