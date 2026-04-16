import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CategoryStore } from '@catalogohoy/category';
import { PlanLimitDialogComponent, PlanStore } from '@catalogohoy/plan';
import { TeamPermissionsStore } from '@catalogohoy/teams';
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
  ToggleComponent,
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
    ToggleComponent,
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
  private readonly permissions = inject(TeamPermissionsStore);
  protected readonly canEditProduct = computed(() => this.permissions.isOwner() || this.permissions.can()('productos', 'edit'));

  @ViewChild(PlanLimitDialogComponent)
  planLimitDialog!: PlanLimitDialogComponent;

  private readonly fb = inject(FormBuilder);

  public readonly form = this.fb.group({
    name: ['', [Validators.required, whiteSpacesValidator()]],
    description: [''],
    sku: [''],
    photos: [[] as string[]],
    price: ['', [Validators.required]],
    pricePromotional: [''],
    productionCost: [''],
    stock: [null as number | null],
    categoryIds: [[] as string[]],
    position: [0],
    isWholesale: [false],
    wholesaleTiers: this.fb.array([]),
    isSoldOut: [false],
    isHidden: [false],
  });

  public readonly id = input<string | undefined>(undefined);
  public readonly photos = signal<string[]>([]);
  public readonly isCreate = signal<boolean>(true);
  public readonly isSubmitting = signal<boolean>(false);
  public readonly isCreatingCategory = signal<boolean>(false);
  public readonly newCategoryName = signal<string>('');
  public readonly stockMode = signal<'unlimited' | 'limited'>('unlimited');

  private readonly photosLimitByPlan: Record<string, number> = {
    gratis: 3,
    basico: 10,
    avanzado: 50,
  };
  public readonly maxPhotos = computed(
    () => this.photosLimitByPlan[this.planStore.currentPlan()?.id ?? 'gratis'] ?? 3
  );
  public readonly photosLimitMessage = computed(() => {
    const planId = this.planStore.currentPlan()?.id ?? 'gratis';
    if (planId === 'gratis') return 'Mejora tu plan para subir hasta 10 o 50 imágenes';
    if (planId === 'basico') return 'Mejora tu plan para subir hasta 50 imágenes';
    return 'Límite de imágenes alcanzado';
  });

  get wholesaleTiersArray(): FormArray {
    return this.form.get('wholesaleTiers') as FormArray;
  }

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
    if (!name || name.trim() === '' || this.isCreatingCategory()) return;

    this.isCreatingCategory.set(true);
    const result = await this.categoryStore.save({
      name: name.trim(),
      isVisible: true,
    });

    result.mapRight(() => {
      this.toastService.success('Categoría creada' as any);
      this.newCategoryName.set('');
    });
    this.isCreatingCategory.set(false);
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

  public onWholesaleToggle(): void {
    const isWholesale = this.form.controls.isWholesale.value;
    if (isWholesale) {
      this.form.controls.price.clearValidators();
      this.form.controls.price.setValue('');
      this.form.controls.pricePromotional.setValue('');
      this.form.controls.productionCost.setValue('');
      if (this.wholesaleTiersArray.length === 0) {
        this.addTier();
      }
    } else {
      this.form.controls.price.setValidators([Validators.required]);
      this.wholesaleTiersArray.clear();
    }
    this.form.controls.price.updateValueAndValidity();
  }

  public addTier(): void {
    this.wholesaleTiersArray.push(
      this.fb.group({
        title: ['', Validators.required],
        price: ['', Validators.required],
      })
    );
  }

  public removeTier(index: number): void {
    this.wholesaleTiersArray.removeAt(index);
  }

  public onStockModeChange(mode: 'unlimited' | 'limited'): void {
    this.stockMode.set(mode);
    if (mode === 'unlimited') {
      this.form.controls.stock.setValue(null);
    } else if (this.form.controls.stock.value === null) {
      this.form.controls.stock.setValue(1);
    }
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
    this.stockMode.set(product.stock !== null ? 'limited' : 'unlimited');
    this.form.controls.categoryIds.setValue(
      product.categoryList.ids as string[]
    );
    this.form.controls.position.setValue(product.position);
    this.photos.set(product.photos);

    this.form.controls.isSoldOut.setValue(product.isSoldOut);
    this.form.controls.isHidden.setValue(product.isHidden);
    this.form.controls.isWholesale.setValue(product.isWholesale);
    if (product.isWholesale) {
      this.form.controls.price.clearValidators();
      this.form.controls.price.updateValueAndValidity();
    }
    this.wholesaleTiersArray.clear();
    product.wholesaleTiers.forEach((tier) => {
      this.wholesaleTiersArray.push(
        this.fb.group({
          title: [tier.title, Validators.required],
          price: [String(tier.price), Validators.required],
        })
      );
    });
  }

  public setPhoto(url: string | string[]) {
    const newPhotos = Array.isArray(url) ? url : [url];
    const currentPhotos = this.photos();
    const limit = this.maxPhotos();

    if (currentPhotos.length + newPhotos.length > limit) {
      this.toastService.error(
        ('Solo puedes subir un máximo de ' +
          limit +
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
    if (this.form.invalid || this.isSubmitting()) return;

    if (this.isCreate() && !this.planStore.canCreateProduct()) {
      this.planLimitDialog.show();
      return;
    }

    this.isSubmitting.set(true);
    const body = {
      id: '',
      name: this.form.controls.name.value as string,
      description: this.form.controls.description.value,
      sku: this.form.controls.sku.value || null,
      productionCost: this.form.controls.productionCost.value || null,
      photos: this.photos(),
      price: this.form.controls.price.value!,
      pricePromotional: this.form.controls.pricePromotional.value!,
      stock: this.form.controls.stock.value != null ? String(this.form.controls.stock.value) : null,
      categoryIds: this.form.controls.categoryIds.value!,
      isWholesale: this.form.controls.isWholesale.value ?? false,
      wholesaleTiers: this.wholesaleTiersArray.value ?? [],
      isSoldOut: this.form.controls.isSoldOut.value ?? false,
      isHidden: this.form.controls.isHidden.value ?? false,
    };
    if (this.isCreate()) {
      const product = await this.productFacade.create(body);
      product
        .mapRight(() => this.router.navigate(['/admin/products']))
        .mapLeft((error) => {
          this.isSubmitting.set(false);
          if (error.message?.includes('PLAN_LIMIT_EXCEEDED')) {
            this.planStore.refreshUsage();
            this.planLimitDialog.show();
          }
        });
    } else {
      body['id'] = this.id() as string;
      (body as any).position = Number(this.form.controls.position.value);
      const product = await this.productFacade.update(body);
      product
        .mapRight(() => this.router.navigate(['/admin/products']))
        .mapLeft(() => this.isSubmitting.set(false));
    }
  }
}
