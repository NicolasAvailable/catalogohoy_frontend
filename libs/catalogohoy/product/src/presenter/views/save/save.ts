import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoryStore } from '@catalogohoy/category';
import { Exception, is } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { whiteSpacesValidator } from '@shared/presenter';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  MultiSelectComponent,
  RadioButtonComponent,
  TextareaComponent,
  UploaderComponent,
} from '@ui';
import { ProductFacade } from '../../../application';
import { Product } from '../../../domain';

@Component({
  selector: 'lib-save',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    UploaderComponent,
    CardComponent,
    InputTextComponent,
    TextareaComponent,
    ButtonComponent,
    IconComponent,
    InputNumberComponent,
    RadioButtonComponent,
    MultiSelectComponent,
  ],
  templateUrl: './save.html',
  styleUrl: './save.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Save implements OnInit {
  private readonly router = inject(Router);
  private readonly toastService = inject(ToastService);
  private readonly productFacade = inject(ProductFacade);
  public readonly categoryStore = inject(CategoryStore);
  public readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, whiteSpacesValidator()]],
    description: [''],
    photos: [[] as string[]],
    price: ['', [Validators.required]],
    pricePromotional: [''],
    stock: [null],
    categoryIds: [[] as string[]],
  });

  public readonly id = input<string | undefined>(undefined);
  public readonly photos = signal<string[]>([]);
  public readonly isCreate = signal<boolean>(true);
  public readonly newCategoryName = signal<string>('');
  private readonly maxPhotos = 3;

  ngOnInit(): void {
    this.categoryStore.categoryList$(1, 100);
    is.affirmative(this.id())
      .mapRight(async () => {
        const product = await this.productFacade.getById(this.id() as string);
        product.mapRight((p) => this.setValuesForm(p));
      })
      .mapRight(() => this.isCreate.set(false));
  }

  public async onCreateCategory() {
    const name = this.newCategoryName();
    if (!name || name.trim() === '') return;

    const result = await this.categoryStore.save({
      name: name.trim(),
      isVisible: true,
    });

    result.mapRight(() => {
      this.toastService.success('Categoría creada' as any);
      this.newCategoryName.set('');
      // Recargar la lista de categorías está manejado por el store.save()
    });
  }

  public onNewCategoryNameChange(event: any) {
    this.newCategoryName.set(event);
  }

  private setValuesForm(product: Product) {
    this.form.controls.name.setValue(product.name);
    this.form.controls.description.setValue(product.description);
    this.form.controls.price.setValue(String(product.price));
    this.form.controls.pricePromotional.setValue(
      String(product.pricePromotional)
    );
    this.form.controls.stock.setValue(product.stock as null);
    this.form.controls.categoryIds.setValue(
      product.categoryList.ids as string[]
    );
    this.photos.set(product.photos);
  }

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

  public async create() {
    if (this.form.invalid) return;
    const body = {
      id: '',
      name: this.form.controls.name.value as string,
      description: this.form.controls.description.value,
      photos: this.photos(),
      price: this.form.controls.price.value!,
      pricePromotional: this.form.controls.pricePromotional.value!,
      stock: this.form.controls.stock.value,
      categoryIds: this.form.controls.categoryIds.value!,
    };
    if (this.isCreate()) {
      const product = await this.productFacade.create(body);
      product.mapRight(() => this.router.navigate(['/admin/products']));
    } else {
      body['id'] = this.id() as string;
      const product = await this.productFacade.update(body);
      product.mapRight(() => this.router.navigate(['/admin/products']));
    }
  }
}
