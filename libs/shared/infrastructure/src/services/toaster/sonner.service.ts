import { Injectable } from '@angular/core';
import { Exception } from '@shared/domain';
import { TranslateService } from '@shared/presenter';
import { toast } from 'ngx-sonner';

@Injectable({ providedIn: 'root' })
export class SonnerToasterService {
  private waitId: string | number | undefined = undefined;

  constructor(private readonly translate: TranslateService) {}

  public success(message: string) {
    toast.success(this.translate.translate(message));
  }

  public error(exception: Exception) {
    toast.error(this.translate.translate(exception.message, exception.params));
  }

  public warning(message: string) {
    toast.warning(this.translate.translate(message));
  }

  public info(message: string) {
    toast.info(this.translate.translate(message));
  }

  public wait(message: string) {
    this.waitId = toast.info(this.translate.translate(message));
  }

  public dismissWait() {
    toast.dismiss(this.waitId);
  }
}
