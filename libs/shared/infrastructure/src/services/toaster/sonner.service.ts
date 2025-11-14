import { Injectable } from '@angular/core';
import { toast } from 'ngx-sonner';
import { TranslateService } from '@shared/presenter';
import { Exception } from '@shared/domain';
import { SonnerComponent } from './sonner.component';
import { error, info, success, wait, warning } from './sonner.model';

@Injectable({ providedIn: 'root' })
export class SonnerToasterService {
  private waitId: string | number | undefined = undefined;

  constructor(private readonly translate: TranslateService) {}

  public success(message: string) {
    toast.custom(SonnerComponent, success(this.translate.translate(message)));
  }

  public error(exception: Exception) {
    toast.custom(SonnerComponent, error(this.translate.translate(exception.message, exception.params)));
  }

  public warning(message: string) {
    toast.custom(SonnerComponent, warning(this.translate.translate(message)));
  }

  public info(message: string) {
    toast.custom(SonnerComponent, info(this.translate.translate(message)));
  }

  public wait(message: string) {
    this.waitId = toast.custom(SonnerComponent, wait(this.translate.translate(message)));
  }

  public dismissWait() {
    toast.dismiss(this.waitId);
  }
}
