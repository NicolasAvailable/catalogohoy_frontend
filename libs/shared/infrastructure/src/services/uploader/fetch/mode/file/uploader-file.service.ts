import { environment } from '@catalogohoy/env';
import { $fetch, aws, BaseUploaderOutput, E } from '@shared/domain';
import { createFilePartService, FilePartService } from './file-part.service';
import { register } from './register.service';

export class FileUploaderService {
  public from(file: File): BaseUploaderOutput {
    const filePartService = createFilePartService();

    return {
      file,
      progress: () => filePartService.getProgress(),
      complete: () => this.upload(file, filePartService),
    };
  }

  private async upload(
    file: File,
    filePartService: FilePartService
  ): Promise<E.Either<Error, string>> {
    const output = await register(file);
    const parts = await filePartService.uploadFileMultipart(
      file,
      output.uploadURL
    );
    try {
      const completeOutput = await this.complete(file, { parts, ...output });
      return E.right(aws.parse(completeOutput.data.Location));
    } catch (error) {
      return E.left(error as Error);
    }
  }

  private async complete(file: File, output: object) {
    return $fetch.post(
      'checkupload_temp',
      { type: file.type, ...output },
      { baseUrl: environment.apiUrl }
    );
  }
}

export const fileUploaderService = new FileUploaderService();
