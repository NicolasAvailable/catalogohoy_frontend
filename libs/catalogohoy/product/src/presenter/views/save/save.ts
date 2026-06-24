import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
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
import { toSignal } from '@angular/core/rxjs-interop';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { Router, RouterLink } from '@angular/router';
import { CategoryStore } from '@catalogohoy/category';
import { TenantCurrencyStore } from '@catalogohoy/ecommerce-config';
import { PlanLimitDialogComponent, PlanStore } from '@catalogohoy/plan';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { TenantStore } from '@catalogohoy/tenant';
import { EditorModule } from 'primeng/editor';
import { Exception, is, isVideoUrl } from '@shared/domain';
import { HtmlSanitizerService, ToastService } from '@shared/infrastructure';
import {
  richTextMaxLengthValidator,
  whiteSpacesValidator,
} from '@shared/presenter';
import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  ImageComponent,
  InputNumberComponent,
  InputTextComponent,
  MultiSelectComponent,
  ProductMediaComponent,
  RadioButtonComponent,
  SelectComponent,
  SelectItemDirective,
  ToggleComponent,
  UploaderComponent,
} from '@ui';
import { ProductFacade } from '../../../application';
import { Product } from '../../../domain';
import { AiImageService, ProductService } from '../../../infrastructure';
import { ImageEraserComponent } from '../../components/image-eraser/image-eraser';
import { ImageGeneratorComponent } from '../../components/image-generator/image-generator';

@Component({
  selector: 'lib-save',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DragDropModule,
    RouterLink,
    UploaderComponent,
    CardComponent,
    InputTextComponent,
    EditorModule,
    ButtonComponent,
    IconComponent,
    ImageComponent,
    ImageEraserComponent,
    ImageGeneratorComponent,
    InputNumberComponent,
    RadioButtonComponent,
    MultiSelectComponent,
    PlanLimitDialogComponent,
    ProductMediaComponent,
    SelectComponent,
    SelectItemDirective,
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
  private readonly productService = inject(ProductService);
  private readonly aiImageService = inject(AiImageService);
  public readonly categoryStore = inject(CategoryStore);
  public readonly planStore = inject(PlanStore);
  public readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly permissions = inject(TeamPermissionsStore);
  // Venezuela exception: admin-side product prices are stored in USD and the
  // public catalog converts to Bs. via the BCV rate. Force '$' + 'USD' in
  // this form so the value the seller enters matches what gets persisted.
  public readonly cs = computed(() =>
    this.tenantCurrency.isVenezuela() ? '$' : this.tenantCurrency.localSymbol() || '$'
  );
  public readonly currencyCode = computed(() =>
    this.tenantCurrency.isVenezuela() ? 'USD' : this.tenantCurrency.localCode() || 'USD'
  );
  protected readonly canEditProduct = computed(() => this.permissions.isOwner() || this.permissions.can()('productos', 'edit'));

  @ViewChild(PlanLimitDialogComponent)
  planLimitDialog!: PlanLimitDialogComponent;

  private readonly fb = inject(FormBuilder);

  public readonly DESCRIPTION_MAX_TEXT_LENGTH = 5000;
  public readonly form = this.fb.group({
    name: ['', [Validators.required, whiteSpacesValidator()]],
    description: ['', [richTextMaxLengthValidator(this.DESCRIPTION_MAX_TEXT_LENGTH)]],
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
    isSized: [false],
    sizes: this.fb.array([]),
    isVariant: [false],
    variants: this.fb.array([]),
  });

  private readonly descriptionValue = toSignal(
    this.form.controls.description.valueChanges,
    { initialValue: this.form.controls.description.value }
  );
  public readonly descriptionTextLength = computed(() => {
    const html = this.descriptionValue() ?? '';
    return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').length;
  });
  // Descripción como texto plano (sin HTML), para usarla en el generador de IA.
  public readonly descriptionPlain = computed(() =>
    (this.descriptionValue() ?? '')
      .replace(/<[^>]*>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

  public readonly id = input<string | undefined>(undefined);
  public readonly photos = signal<string[]>([]);
  // URLs cuyo fondo se está removiendo con IA ahora mismo (varias a la vez).
  // Se usa para mostrar el spinner y deshabilitar el botón por imagen.
  public readonly aiProcessing = signal<ReadonlySet<string>>(new Set());
  // Borrador manual (pincel): qué foto está abierta en el editor.
  public readonly eraserPhoto = signal<string | null>(null);
  // Generador de imagen con IA: si el modal está abierto.
  public readonly generatorOpen = signal<boolean>(false);
  // Mejorar descripción con IA: opciones del ui-select (cada una con su icono),
  // valor seleccionado (se resetea tras elegir) y flag de procesando.
  public readonly improveModes = [
    { label: 'Mejorar redacción', value: 'improve', icon: 'wand-sparkles' },
    { label: 'Alargar', value: 'expand', icon: 'plus' },
    { label: 'Acortar', value: 'shorten', icon: 'minus' },
  ];
  public readonly improveModeValue = signal<string | null>(null);
  public readonly improvingDesc = signal<boolean>(false);
  public readonly isCreate = signal<boolean>(true);
  public readonly isSubmitting = signal<boolean>(false);
  public readonly isCreatingCategory = signal<boolean>(false);
  public readonly newCategoryName = signal<string>('');
  // The "Ver todos" category is a special pill shown only on the public
  // catalog (acts as a clear-filter). Products must never be assigned to it,
  // so it's hidden from the create/edit dropdown.
  public readonly selectableCategories = computed(() =>
    this.categoryStore
      .categoryList()
      .categories.filter((c) => !c.isViewAll)
  );
  public readonly hasCategories = computed(
    () => this.selectableCategories().length > 0
  );

  /** Strip any IDs that don't map to a real (selectable) category — e.g. the
   *  hidden "Ver todos" pseudo-category that legacy products may still have
   *  assigned. Without this, those IDs render as empty chips in the
   *  multi-select. The effect waits for categories to load before sanitizing
   *  so we don't wipe valid IDs during the initial fetch. */
  private readonly sanitizeCategoryIds = effect(() => {
    const selectable = this.selectableCategories();
    if (selectable.length === 0) return;
    const validIds = new Set(selectable.map((c) => String(c.id)));
    const currentRaw = this.form.controls.categoryIds.value ?? [];
    const cleaned = currentRaw
      .filter((id): id is string => !!id && validIds.has(String(id)))
      .map(String);
    if (cleaned.length !== currentRaw.length) {
      this.form.controls.categoryIds.setValue(cleaned, { emitEvent: false });
    }
  });
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

  get sizesArray(): FormArray {
    return this.form.get('sizes') as FormArray;
  }
  get variantsArray(): FormArray {
    return this.form.get('variants') as FormArray;
  }

  private readonly sizesValue = toSignal(this.sizesArray.valueChanges, {
    initialValue: this.sizesArray.value,
  });
  private readonly isSizedValue = toSignal(
    this.form.controls.isSized.valueChanges,
    { initialValue: this.form.controls.isSized.value }
  );

  /** Sizes for a specific variant (each variant owns its tallas). */
  public variantSizesArray(variantIndex: number): FormArray {
    return this.variantsArray.at(variantIndex).get('sizes') as FormArray;
  }

  /** Sum of stock across all sizes. `null` when any size is unlimited
   *  (so the product as a whole inherits "unlimited"). */
  public readonly totalSizedStock = computed(() => {
    if (!this.isSizedValue()) return null;
    const sizes = (this.sizesValue() ?? []) as {
      name: string;
      stock: string | number | null;
    }[];
    if (sizes.length === 0) return 0;
    if (sizes.some((s) => s.stock === null || s.stock === '')) return null;
    return sizes.reduce((acc, s) => acc + Number(s.stock || 0), 0);
  });

  ngOnInit(): void {
    this.categoryStore.categoryList$(1, 100);
    this.planStore.loadTenantPlanUsage();
    this.tenantStore.getTenantIdAsync().then((tid) => {
      if (tid) this.tenantCurrency.load(tid);
    });
    is.affirmative(this.id())
      .mapRight(async () => {
        // Block editing a product the free-plan cap has locked (reached via a
        // direct URL — the list already hides the edit action for these).
        await this.planStore.loadTenantPlanUsage();
        if (this.planStore.isFreePlan()) {
          const locked = await this.productService.isLockedByFreePlan(
            this.id() as string,
            this.planStore.maxProducts()
          );
          if (locked) {
            this.toastService.error(
              ('Este producto está oculto por el límite del plan Gratis. ' +
                'Mejora tu plan para editarlo.') as unknown as Exception
            );
            this.router.navigate(['/admin/products']);
            return;
          }
        }
        const product = await this.productFacade.getById(this.id() as string);
        product.mapRight((p) => this.setValuesForm(p));
      })
      .mapRight(() => this.isCreate.set(false));
  }

  public async onCreateCategory() {
    const name = this.newCategoryName().trim();
    if (!name || this.isCreatingCategory()) return;

    this.isCreatingCategory.set(true);
    const result = await this.categoryStore.save({
      name,
      isVisible: true,
    });

    if (result.isRight()) {
      // The store re-fetches after save and can race with the optimistic
      // insert, so resolve the new category's id from the visible list by
      // name AFTER the store has settled. Wait a microtask plus a frame so
      // both `patchState` calls (optimistic + re-fetch) have run.
      await new Promise((resolve) => setTimeout(resolve, 0));

      const stored = this.selectableCategories().find((c) => c.name === name);
      if (stored) {
        const validIds = new Set(
          this.selectableCategories().map((c) => String(c.id))
        );
        const current = (this.form.controls.categoryIds.value ?? [])
          .filter((id): id is string => !!id && validIds.has(String(id)))
          .map(String);
        this.form.controls.categoryIds.setValue([
          ...current,
          String(stored.id),
        ]);
      }
      this.toastService.success('Categoría creada' as any);
      this.newCategoryName.set('');
    }
    this.isCreatingCategory.set(false);
  }

  public onNewCategoryNameChange(event: any) {
    this.newCategoryName.set(event);
  }

  /** Copia al portapapeles la URL pública del producto que se está editando.
   *  Mismo patrón que el listado: `https://{slug}.catalogohoy.com/?product={id}`. */
  public async onShare(): Promise<void> {
    const slug = this.tenantStore.tenantSlug();
    const productId = this.id();
    if (!slug || !productId) return;
    const url = `https://${slug}.catalogohoy.com/?product=${productId}`;
    try {
      await navigator.clipboard.writeText(url);
      this.toastService.success('Link copiado al portapapeles');
    } catch {
      /* clipboard puede no estar disponible en navegadores muy viejos */
    }
  }

  public generateSku(): void {
    const name = this.form.controls.name.value || '';
    if (!name.trim()) return;
    const words = name.trim().toUpperCase().split(/\s+/);
    const prefix = words.map((w) => w.slice(0, 3)).join('-');
    const suffix = Math.floor(1000 + Math.random() * 9000);
    this.form.controls.sku.setValue(`${prefix}-${suffix}`);
  }

  /** The base price is optional when variants or wholesale tiers carry the
   *  price; required otherwise (sizes-only still share one base price). */
  private updatePriceValidator(): void {
    const optional =
      !!this.form.controls.isWholesale.value ||
      !!this.form.controls.isVariant.value;
    if (optional) {
      this.form.controls.price.clearValidators();
    } else {
      this.form.controls.price.setValidators([Validators.required]);
    }
    this.form.controls.price.updateValueAndValidity();
  }

  public onWholesaleToggle(): void {
    const isWholesale = this.form.controls.isWholesale.value;
    if (isWholesale) {
      // Wholesale is exclusive with sizes AND variants — turning it on simply
      // switches those off (no disabling → fewer clicks).
      if (this.form.controls.isSized.value) {
        this.form.controls.isSized.setValue(false);
        this.sizesArray.clear();
      }
      if (this.form.controls.isVariant.value) {
        this.form.controls.isVariant.setValue(false);
        this.variantsArray.clear();
      }
      this.form.controls.price.setValue('');
      this.form.controls.pricePromotional.setValue('');
      this.form.controls.productionCost.setValue('');
      if (this.wholesaleTiersArray.length === 0) {
        this.addTier();
      }
    } else {
      this.wholesaleTiersArray.clear();
    }
    this.updatePriceValidator();
  }

  public onSizedToggle(): void {
    const isSized = this.form.controls.isSized.value;
    if (isSized) {
      // Sizes coexist with variants but are exclusive with wholesale.
      if (this.form.controls.isWholesale.value) {
        this.form.controls.isWholesale.setValue(false);
        this.wholesaleTiersArray.clear();
      }
      // Sized products derive stock from per-size inputs — clear the
      // product-level stock and force "unlimited".
      this.stockMode.set('unlimited');
      this.form.controls.stock.setValue(null);
      if (this.sizesArray.length === 0) {
        this.addSize();
      }
    } else {
      this.sizesArray.clear();
    }
    this.updatePriceValidator();
  }

  public addSize(): void {
    this.sizesArray.push(
      this.fb.group({
        name: ['', Validators.required],
        stock: [null as string | null],
        sku: [''],
      })
    );
  }

  public removeSize(index: number): void {
    this.sizesArray.removeAt(index);
  }

  /** Per-variant sizes — each variant owns its tallas. */
  public addVariantSize(variantIndex: number): void {
    this.variantSizesArray(variantIndex).push(
      this.fb.group({
        name: ['', Validators.required],
        stock: [null as string | null],
        sku: [''],
      })
    );
  }

  public removeVariantSize(variantIndex: number, sizeIndex: number): void {
    this.variantSizesArray(variantIndex).removeAt(sizeIndex);
  }

  /** True while the current plan still allows adding another variant.
   *  Re-evaluated each change-detection (add/remove run on user clicks). */
  public canAddVariant(): boolean {
    return this.variantsArray.length < this.planStore.maxVariants();
  }

  /** Variants have no toggle — the section is driven by the list itself.
   *  Adding the first variant flips the derived `isVariant` flag on. */
  public addVariant(): void {
    if (!this.canAddVariant()) {
      this.toastService.error(
        (`Tu plan permite hasta ${this.planStore.maxVariants()} ` +
          'variantes por producto. Mejora tu plan para agregar más.') as unknown as Exception
      );
      return;
    }
    const wasEmpty = this.variantsArray.length === 0;
    if (wasEmpty && this.form.controls.isWholesale.value) {
      // Variants are exclusive with wholesale — adding one turns it off.
      this.form.controls.isWholesale.setValue(false);
      this.wholesaleTiersArray.clear();
      this.form.controls.pricePromotional.setValue('');
      this.form.controls.productionCost.setValue('');
    }
    this.variantsArray.push(
      this.fb.group({
        id: [crypto.randomUUID() as string | null],
        name: ['', Validators.required],
        price: ['', Validators.required],
        originalPrice: [''],
        sku: [''],
        photos: [[] as string[]],
        // Each variant owns its tallas.
        sizes: this.fb.array([]),
      })
    );
    this.form.controls.isVariant.setValue(true);
    this.updatePriceValidator();
  }

  public removeVariant(index: number): void {
    this.variantsArray.removeAt(index);
    if (this.variantsArray.length === 0) {
      this.form.controls.isVariant.setValue(false);
    }
    this.updatePriceValidator();
  }

  /** Variant uploader is multiple — append the uploaded media (images/videos)
   *  to the variant's own gallery, just like the product media uploader. */
  public addVariantPhotos(index: number, url: string | string[]): void {
    const urls = Array.isArray(url) ? url : [url];
    const ctrl = this.variantsArray.at(index).get('photos');
    const current = (ctrl?.value as string[]) ?? [];
    // Each variant gallery respects the same per-plan image cap as the product
    // media (gratis 3 / basico 10 / avanzado 50): add what fits, warn on the rest.
    const limit = this.maxPhotos();
    const fresh = urls.filter((u) => u && !current.includes(u));
    const remaining = Math.max(0, limit - current.length);
    const toAdd = fresh.slice(0, remaining);
    if (fresh.length > toAdd.length) {
      this.toastService.error(
        (`Solo puedes subir hasta ${limit} imágenes por variante en tu plan.`) as unknown as Exception
      );
    }
    if (toAdd.length === 0) return;
    ctrl?.setValue([...current, ...toAdd]);
  }

  /** True when the variant's gallery already reached the per-plan cap. */
  public variantPhotosFull(index: number): boolean {
    const photos =
      (this.variantsArray.at(index).get('photos')?.value as string[]) ?? [];
    return photos.length >= this.maxPhotos();
  }

  public removeVariantPhoto(index: number, url: string): void {
    const ctrl = this.variantsArray.at(index).get('photos');
    const current = (ctrl?.value as string[]) ?? [];
    ctrl?.setValue(current.filter((u) => u !== url));
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

    this.form.controls.isSized.setValue(product.isSized);
    this.sizesArray.clear();
    product.sizes.forEach((size) => {
      this.sizesArray.push(
        this.fb.group({
          name: [size.name, Validators.required],
          stock: [size.stock != null ? String(size.stock) : null],
          sku: [size.sku ?? ''],
        })
      );
    });

    this.form.controls.isVariant.setValue(product.isVariant);
    if (product.isVariant) {
      this.form.controls.price.clearValidators();
      this.form.controls.price.updateValueAndValidity();
    }
    this.variantsArray.clear();
    product.variants.forEach((variant) => {
      this.variantsArray.push(
        this.fb.group({
          id: [variant.id ?? null],
          name: [variant.name, Validators.required],
          price: [String(variant.price), Validators.required],
          originalPrice: [
            variant.originalPrice ? String(variant.originalPrice) : '',
          ],
          sku: [variant.sku ?? ''],
          photos: [variant.photos ?? []],
          sizes: this.fb.array(
            (variant.sizes ?? []).map((s) =>
              this.fb.group({
                name: [s.name, Validators.required],
                stock: [s.stock != null ? String(s.stock) : null],
                sku: [s.sku ?? ''],
              })
            )
          ),
        })
      );
    });
  }

  public setPhoto(url: string | string[]) {
    const newPhotos = Array.isArray(url) ? url : [url];
    const currentPhotos = this.photos();
    const limit = this.maxPhotos();

    const uniquePhotos = newPhotos.filter(
      (photo) => !currentPhotos.includes(photo)
    );

    // Con carga múltiple el usuario puede elegir más fotos que las que entran
    // en su plan: agregamos las que caben y avisamos por el resto en vez de
    // rechazar todo el lote.
    const remaining = Math.max(0, limit - currentPhotos.length);
    const toAdd = uniquePhotos.slice(0, remaining);

    if (uniquePhotos.length > toAdd.length) {
      this.toastService.error(
        ('Solo puedes subir un máximo de ' +
          limit +
          ' imágenes.') as unknown as Exception
      );
    }

    if (toAdd.length === 0) return;

    this.photos.update((photos) => [...photos, ...toAdd]);
    this.form.controls.photos.setValue(this.photos());
  }

  public removePhoto(url: string) {
    this.photos.update((photos) => photos.filter((photo) => photo !== url));
    this.form.controls.photos.setValue(this.photos());
  }

  /** Una entrada de la galería puede ser foto o video; solo las fotos
   *  admiten preview de zoom y remover-fondo con IA. */
  public isVideo(url: string): boolean {
    return isVideoUrl(url);
  }

  public isAiProcessing(url: string): boolean {
    return this.aiProcessing().has(url);
  }

  /** Remueve el fondo de una imagen con IA (fal.ai / BiRefNet vía la Edge
   *  Function `fal-ai-images`). Reemplaza la imagen original por la versión
   *  recortada en el mismo lugar, conservando el orden y la portada. */
  public async removeBackground(url: string) {
    if (this.isVideo(url) || this.isAiProcessing(url)) return;

    this.aiProcessing.update((set) => new Set(set).add(url));
    this.toastService.wait('Quitando fondo con IA…');
    try {
      const result = await this.aiImageService.removeBackground(url);
      result
        .mapRight((newUrl) => {
          this.photos.update((photos) =>
            photos.map((photo) => (photo === url ? newUrl : photo))
          );
          this.form.controls.photos.setValue(this.photos());
          this.toastService.success('Fondo removido con IA');
        })
        .mapLeft((error) => this.toastService.error(new Exception(error.message)));
    } finally {
      this.toastService.dismissWait();
      this.aiProcessing.update((set) => {
        const next = new Set(set);
        next.delete(url);
        return next;
      });
    }
  }

  // ───── Borrador manual (pincel, estilo Canva/CapCut) ─────

  /** Abre el editor de borrador para una imagen. */
  public openEraser(photo: string) {
    if (this.isVideo(photo)) return;
    this.eraserPhoto.set(photo);
  }

  public closeEraser() {
    this.eraserPhoto.set(null);
  }

  /** El borrador subió el PNG editado: reemplaza la imagen en su lugar
   *  (conserva orden/portada) y cierra el editor. */
  public onEraserApplied(newUrl: string) {
    const photo = this.eraserPhoto();
    if (!photo) return;
    this.photos.update((photos) =>
      photos.map((p) => (p === photo ? newUrl : p))
    );
    this.form.controls.photos.setValue(this.photos());
    this.closeEraser();
  }

  // ───── Generar imagen con IA (FLUX) ─────

  public openGenerator() {
    this.generatorOpen.set(true);
  }

  public closeGenerator() {
    this.generatorOpen.set(false);
  }

  /** La IA generó una imagen: la agregamos a la galería (respeta el límite del
   *  plan vía setPhoto) y cerramos el modal. */
  public onGenerated(url: string) {
    this.setPhoto(url);
    this.closeGenerator();
  }

  // ───── Mejorar descripción con IA (Claude Haiku) ─────

  /** El ui-select emite el modo elegido; lo reseteamos a placeholder y mejoramos. */
  public onImproveMode(mode: string | null) {
    if (!mode) return;
    this.improveModeValue.set(null);
    this.improveDescription(mode as 'improve' | 'expand' | 'shorten');
  }

  public async improveDescription(mode: 'improve' | 'expand' | 'shorten') {
    const text = this.descriptionPlain();
    if (text.length < 15 || this.improvingDesc()) return;
    this.improvingDesc.set(true);
    this.toastService.wait('Mejorando con IA…');
    try {
      const result = await this.aiImageService.improveText(text, mode);
      result
        .mapRight((html) => {
          this.form.controls.description.setValue(html);
          this.toastService.success('Descripción mejorada con IA');
        })
        .mapLeft((e) => this.toastService.error(new Exception(e.message)));
    } finally {
      this.toastService.dismissWait();
      this.improvingDesc.set(false);
    }
  }

  /** Reorder the uploaded media via drag & drop. The first photo is the cover
   *  shown in the catalog, so order is meaningful. */
  public dropPhoto(event: CdkDragDrop<string[]>) {
    if (event.previousIndex === event.currentIndex) return;
    this.photos.update((photos) => {
      const next = [...photos];
      moveItemInArray(next, event.previousIndex, event.currentIndex);
      return next;
    });
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
      isSized: this.form.controls.isSized.value ?? false,
      sizes: this.sizesArray.value ?? [],
      isVariant: this.form.controls.isVariant.value ?? false,
      variants: this.variantsArray.value ?? [],
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
