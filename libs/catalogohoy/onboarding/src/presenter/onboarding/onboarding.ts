import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  ColorPickerComponent,
  IconComponent,
  InputNumberComponent,
  InputPhoneComponent,
  InputTextComponent,
  MultiSelectComponent,
  UploaderComponent,
} from '@ui';
import { CategoryStore } from '@catalogohoy/category';
import {
  EcommerceConfigStore,
  THEME_COLORS,
} from '@catalogohoy/ecommerce-config';
import { CreateProductInput, ProductService } from '@catalogohoy/product';
import { ProfileStore } from '@catalogohoy/profile';
import { TenantStore } from '@catalogohoy/tenant';

type Step = 1 | 2 | 3 | 4;

/** Clave de localStorage que marca el onboarding como completado por tenant.
 *  Evita re-disparar el wizard (hasta tener un flag en DB). */
export const onboardingDoneKey = (tenantId: string | number) =>
  `chy_onboarding_done_${tenantId}`;

@Component({
  selector: 'lib-onboarding',
  standalone: true,
  imports: [
    FormsModule,
    TranslocoPipe,
    ButtonComponent,
    ColorPickerComponent,
    IconComponent,
    InputNumberComponent,
    InputPhoneComponent,
    InputTextComponent,
    MultiSelectComponent,
    UploaderComponent,
  ],
  templateUrl: './onboarding.html',
  styleUrl: './onboarding.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Onboarding implements OnInit {
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  private readonly tenantStore = inject(TenantStore);
  private readonly profileStore = inject(ProfileStore);
  public readonly configStore = inject(EcommerceConfigStore);
  public readonly categoryStore = inject(CategoryStore);
  private readonly productService = inject(ProductService);

  public readonly themeColors = THEME_COLORS;
  public readonly totalSteps = 4;
  public readonly step = signal<Step>(1);
  private tenantId: string | null = null;

  // ── Paso 1: tu información + WhatsApp (obligatorio) ─────────────────────
  public readonly userName = signal('');
  public readonly whatsapp = signal('');
  public readonly countryIso = signal('ve');

  // ── Paso 2: tu catálogo ─────────────────────────────────────────────────
  public readonly storeName = signal('');
  public readonly logoUrl = signal<string | null>(null);
  public readonly themeColor = signal('#10b981');
  public readonly slug = signal('');

  // ── Paso 3: categorías ──────────────────────────────────────────────────
  public readonly newCategoryName = signal('');
  public readonly creatingCategory = signal(false);

  // ── Paso 4: primer producto ─────────────────────────────────────────────
  public readonly productName = signal('');
  public readonly productPrice = signal<number | null>(null);
  public readonly productPhotos = signal<string[]>([]);
  public readonly productCategoryIds = signal<string[]>([]);

  public readonly isSaving = signal(false);

  /** Categorías reales del catálogo (excluye la sembrada "Ver todos"). */
  public readonly categories = computed(() =>
    this.categoryStore
      .categoryList()
      .categories.filter((c) => !c.isViewAll)
  );
  public readonly categoryOptions = computed(() =>
    this.categories().map((c) => ({ id: c.id, name: c.name }))
  );

  public readonly step1Valid = computed(
    () => this.whatsapp().trim().length > 0
  );
  public readonly step2Valid = computed(
    () => this.storeName().trim().length > 0
  );
  public readonly step4Valid = computed(
    () =>
      this.productName().trim().length > 0 && (this.productPrice() ?? 0) > 0
  );

  /** URL pública del catálogo (para mostrar el link en el preview). */
  public readonly storeUrl = computed(() =>
    this.slug() ? `${this.slug()}.catalogohoy.com` : ''
  );

  async ngOnInit(): Promise<void> {
    const id = await this.tenantStore.getTenantIdAsync();
    if (id == null) return;
    this.tenantId = String(id);

    await this.configStore.loadConfig(this.tenantId);
    const config = this.configStore.config();
    const profile = this.profileStore.profile();

    // Prefills: nombre del perfil, nombre/color/logo del catálogo ya creado.
    this.userName.set(profile?.name ?? '');
    this.storeName.set(config?.name ?? '');
    this.themeColor.set(config?.themeColor || '#10b981');
    this.logoUrl.set(config?.logo ?? null);
    this.slug.set(this.tenantStore.tenant().tenantSlug ?? '');
    this.countryIso.set((config?.countryCode ?? 've').toLowerCase());

    const existing = config?.whatsappButtons?.[0]?.number;
    if (existing) this.whatsapp.set(existing);

    this.categoryStore.categoryList$(1, 100);
  }

  // ── Navegación ──────────────────────────────────────────────────────────
  public back(): void {
    if (this.step() > 1) this.step.update((s) => (s - 1) as Step);
  }

  /** Paso 1 → guarda el WhatsApp del vendedor (whatsappButtons) y avanza. */
  public async nextFromStep1(): Promise<void> {
    if (!this.step1Valid() || this.isSaving()) return;
    this.isSaving.set(true);
    await this.configStore.updatePartialConfig({
      whatsappButtons: [
        {
          name: this.userName().trim() || 'WhatsApp',
          number: this.whatsapp().trim(),
        },
      ],
    });
    this.isSaving.set(false);
    this.step.set(2);
  }

  /** Paso 2 → guarda nombre/color/logo del catálogo y avanza. */
  public async nextFromStep2(): Promise<void> {
    if (!this.step2Valid() || this.isSaving()) return;
    this.isSaving.set(true);
    await this.configStore.updatePartialConfig({
      name: this.storeName().trim(),
      themeColor: this.themeColor(),
      logo: this.logoUrl(),
    });
    this.isSaving.set(false);
    this.step.set(3);
  }

  public nextFromStep3(): void {
    this.step.set(4);
  }

  public onLogoUpload(url: string | string[]): void {
    const first = Array.isArray(url) ? url[0] : url;
    if (first) this.logoUrl.set(first);
  }

  public removeLogo(): void {
    this.logoUrl.set(null);
  }

  public selectColor(color: string): void {
    this.themeColor.set(color);
  }

  // ── Categorías ──────────────────────────────────────────────────────────
  public async createCategory(): Promise<void> {
    const name = this.newCategoryName().trim();
    if (!name || this.creatingCategory()) return;
    this.creatingCategory.set(true);
    const result = await this.categoryStore.save({ name, isVisible: true });
    result
      .mapRight(() => {
        this.newCategoryName.set('');
        this.toast.success('Categoría creada');
      })
      .mapLeft((e: Error) => this.toast.error(e as unknown as Exception));
    this.creatingCategory.set(false);
  }

  // ── Producto + finalizar ────────────────────────────────────────────────
  public onProductPhoto(url: string | string[]): void {
    const urls = Array.isArray(url) ? url : [url];
    this.productPhotos.update((cur) => [...cur, ...urls.filter(Boolean)]);
  }

  public removeProductPhoto(url: string): void {
    this.productPhotos.update((cur) => cur.filter((u) => u !== url));
  }

  /** Crea el primer producto y termina el onboarding. */
  public async finish(): Promise<void> {
    if (!this.step4Valid() || this.isSaving()) return;
    this.isSaving.set(true);

    const input: CreateProductInput = {
      name: this.productName().trim(),
      description: null,
      price: String(this.productPrice() ?? 0),
      pricePromotional: '',
      photos: this.productPhotos(),
      stock: null,
      categoryIds: this.productCategoryIds(),
      sku: null,
      productionCost: null,
      isWholesale: false,
      wholesaleTiers: [],
      isSoldOut: false,
      isHidden: false,
      isSized: false,
      sizes: [],
      isVariant: false,
      variants: [],
      addons: [],
    };

    const result = await this.productService.create(input);
    result
      .mapRight(() => {
        this.toast.success('¡Tu tienda está lista!');
        this.complete();
      })
      .mapLeft((e: Error) => {
        this.toast.error(e as unknown as Exception);
        this.isSaving.set(false);
      });
  }

  /** Termina sin crear producto (Omitir). */
  public skipProduct(): void {
    this.complete();
  }

  private complete(): void {
    if (this.tenantId) {
      try {
        localStorage.setItem(onboardingDoneKey(this.tenantId), '1');
      } catch {
        /* ignore quota/private-mode */
      }
    }
    this.router.navigate(['/admin']);
  }
}
