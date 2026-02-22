import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import {
  FormBuilder,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoryStore } from '@catalogohoy/category';
import { PlanLimitDialogComponent, PlanStore } from '@catalogohoy/plan';
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
    PlanLimitDialogComponent,
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
  public readonly planStore = inject(PlanStore);

  @ViewChild(PlanLimitDialogComponent)
  planLimitDialog!: PlanLimitDialogComponent;

  public readonly form = inject(FormBuilder).group({
    name: ['', [Validators.required, whiteSpacesValidator()]],
    description: [''],
    sku: [''],
    photos: [[] as string[]],
    price: ['', [Validators.required]],
    pricePromotional: [''],
    productionCost: [''],
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
    this.planStore.loadTenantPlanUsage();
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

  public generateSku(): void {
    const name = this.form.controls.name.value || '';
    if (!name.trim()) return;
    const words = name.trim().toUpperCase().split(/\s+/);
    const prefix = words.map((w) => w.slice(0, 3)).join('-');
    const suffix = Math.floor(1000 + Math.random() * 9000);
    this.form.controls.sku.setValue(`${prefix}-${suffix}`);
  }

  private setValuesForm(product: Product) {
    this.form.controls.name.setValue(product.name);
    this.form.controls.description.setValue(product.description);
    this.form.controls.sku.setValue(product.sku ?? '');
    this.form.controls.productionCost.setValue(
      product.productionCost != null ? String(product.productionCost) : ''
    );
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

    if (this.isCreate() && !this.planStore.canCreateProduct()) {
      this.planLimitDialog.show();
      return;
    }

    const body = {
      id: '',
      name: this.form.controls.name.value as string,
      description: this.form.controls.description.value,
      sku: this.form.controls.sku.value || null,
      productionCost: this.form.controls.productionCost.value || null,
      photos: this.photos(),
      price: this.form.controls.price.value!,
      pricePromotional: this.form.controls.pricePromotional.value!,
      stock: this.form.controls.stock.value,
      categoryIds: this.form.controls.categoryIds.value!,
    };
    if (this.isCreate()) {
      const product = await this.productFacade.create(body);
      product
        .mapRight(() => this.router.navigate(['/admin/products']))
        .mapLeft((error) => {
          if (error.message?.includes('PLAN_LIMIT_EXCEEDED')) {
            this.planStore.refreshUsage();
            this.planLimitDialog.show();
          }
        });
    } else {
      body['id'] = this.id() as string;
      const product = await this.productFacade.update(body);
      product.mapRight(() => this.router.navigate(['/admin/products']));
    }
  }
}
