import { aws, E, BaseUploaderOutput, $fetch } from '@shared/domain';
import { environment } from '@socialgest/env';
import { register } from './register.service';
import { createFilePartService, FilePartService } from './file-part.service';

export class FileUploaderService {
  public from(file: File): BaseUploaderOutput {
    const filePartService = createFilePartService();

    return {
      file,
      progress: () => filePartService.getProgress(),
      complete: () => this.upload(file, filePartService),
    };
  }

  private async upload(file: File, filePartService: FilePartService): Promise<E.Either<Error, string>> {
    const output = await register(file);
    const parts = await filePartService.uploadFileMultipart(file, output.uploadURL);
    try {
      const completeOutput = await this.complete(file, { parts, ...output });
      return E.right(aws.parse(completeOutput.data.Location));
    } catch (error) {
      return E.left(error as Error);
    }
  }

  private async complete(file: File, output: object) {
    return $fetch.post('checkupload_temp', { type: file.type, ...output }, { baseUrl: environment.apiUrlV1 });
  }
}

export const fileUploaderService = new FileUploaderService();
