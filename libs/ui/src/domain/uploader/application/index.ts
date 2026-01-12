import { inject, Injectable } from '@angular/core';
import { UploaderService } from '../infrastructure';
import { UploadUseCase, UploadUseCaseInput } from './upload/upload.usecase';

@Injectable({ providedIn: 'root' })
export class UploaderFacade {
  private readonly uploaderService = inject(UploaderService);

  public upload(input: UploadUseCaseInput) {
    return new UploadUseCase(this.uploaderService).execute(input);
  }
}
