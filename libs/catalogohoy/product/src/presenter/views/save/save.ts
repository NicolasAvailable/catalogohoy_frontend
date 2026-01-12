import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  RadioButtonComponent,
  TextareaComponent,
  UploaderComponent,
} from '@ui';
import { ProductFacade } from '../../../application';

@Component({
  selector: 'lib-save',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    UploaderComponent,
    CardComponent,
    InputTextComponent,
    TextareaComponent,
    ButtonComponent,
    IconComponent,
    InputNumberComponent,
    RadioButtonComponent,
  ],
  templateUrl: './save.html',
  styleUrl: './save.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Save {
  private readonly productFacade = inject(ProductFacade);
  public readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, whiteSpacesValidator()]],
    description: [''],
    photos: [[] as string[]],
    price: ['', [Validators.required]],
    pricePromotional: [''],
    stock: [null],
  });

  public readonly toastService = inject(ToastService);
  public readonly photos = signal<string[]>([]);
  private readonly maxPhotos = 3;

  public setPhoto(url: string | string[]) {
    const newPhotos = Array.isArray(url) ? url : [url];
    const currentPhotos = this.photos();

    if (currentPhotos.length + newPhotos.length > this.maxPhotos) {
      this.toastService.error(
        ('Solo puedes subir un máximo de ' +
          this.maxPhotos +
          ' imágenes.') as unknown as Exception
      );
      return;
    }

    const uniquePhotos = newPhotos.filter(
      (photo) => !currentPhotos.includes(photo)
    );

    this.photos.update((photos) => [...photos, ...uniquePhotos]);
    this.form.controls.photos.setValue(this.photos());
  }

  public removePhoto(url: string) {
    this.photos.update((photos) => photos.filter((photo) => photo !== url));
    this.form.controls.photos.setValue(this.photos());
  }

  public create() {
    if (this.form.invalid) return;
    const body = this.form.getRawValue();
    this.productFacade.create({
      name: body.name!,
      description: body.description,
      photos: body.photos,
      price: body.price!,
      pricePromotional: body.pricePromotional!,
      stock: body.stock,
    });
  }
}
