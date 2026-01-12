import { lastValueFrom } from 'rxjs';
import { UseCase } from '@shared/application';
import { E } from '@shared/domain';
import { BaseUploaderService, UploaderList } from '../../domain';

export type UploadUseCaseInput = { files: File[] };

export class UploadUseCase extends UseCase<UploadUseCaseInput, Promise<E.Either<Error, UploaderList>>> {
  constructor(private readonly uploaderService: BaseUploaderService) {
    super();
  }

  public async execute(input: UploadUseCaseInput): Promise<E.Either<Error, UploaderList>> {
    const outputs = input.files.map((file) => lastValueFrom(this.uploaderService.upload(file)));
    return E.right(UploaderList.from(await Promise.all(outputs)));
  }
}
