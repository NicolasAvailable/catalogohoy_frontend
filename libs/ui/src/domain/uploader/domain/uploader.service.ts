import { Observable } from 'rxjs';
import { BaseUploaderOutput } from '@shared/domain';

export interface BaseUploaderService {
  upload(file: File): Observable<BaseUploaderOutput>;
}
