import { E, BaseUploaderService, BaseUploaderOutput } from '@shared/domain';
import { fileUploaderService, urlUploaderService } from './mode';

class UploaderService implements BaseUploaderService {
  public fromFile(file: File): BaseUploaderOutput {
    return fileUploaderService.from(file);
  }

  public fromUrl(url: string): Promise<E.Either<Error, string>> {
    return urlUploaderService.from(url);
  }
}

export const uploaderService = new UploaderService();
