import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  isDevMode,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { authenticationTokenService } from '@catalogohoy/auth';
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
  ToggleComponent,
  UploaderComponent,
} from '@ui';
import { CategoryStore } from '@catalogohoy/category';
import {
  EcommerceConfig,
  EcommerceConfigService,
  EcommerceConfigStore,
  PhoneMockupComponent,
  PreviewMessage,
  detectPaymentMethodType,
  PaymentFieldDef,
  paymentMethodFields,
  PaymentMethodEntity,
  ShippingMethod,
  ShippingMethodType,
  THEME_COLORS,
} from '@catalogohoy/ecommerce-config';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { CreateProductInput, ProductService } from '@catalogohoy/product';
import { ProfileStore } from '@catalogohoy/profile';
import { TenantService, TenantStore } from '@catalogohoy/tenant';

/** Los 3 pasos del wizard (estilo Take App):
 *  tienda (datos + logo + color + dirección) → primer producto → entrega+pago.
 *  Se navegan por índice sobre STEP_IDS (lista + índice, no números mágicos). */
type StepId = 'store' | 'product' | 'setup';

const STEP_IDS: StepId[] = ['store', 'product', 'setup'];

/** Clave de localStorage que marca el onboarding como completado por tenant.
 *  Evita re-disparar el wizard (hasta tener un flag en DB). */
export const onboardingDoneKey = (tenantId: string | number) =>
  `chy_onboarding_done_${tenantId}`;

/** Prefijos de slug temporal que crea el trigger de signup (handle_new_user):
 *  'tienda-XXXXXX' o 'mi-tienda-XXXXXX' según el seed. Mientras el slug sea
 *  temporal, la dirección se autogenera desde el nombre; en el wizard el campo
 *  es SIEMPRE editable sea cual sea el slug. */
const TEMP_SLUG_PREFIXES = ['tienda-', 'mi-tienda-'];

const isTempSlugValue = (slug: string): boolean =>
  TEMP_SLUG_PREFIXES.some((p) => slug.startsWith(p));

/** Draft de una card de entrega (paso Entrega y pago). */
interface ShippingDraft {
  type: ShippingMethodType;
  label: string;
  hint: string;
  icon: string;
  active: boolean;
  fee: number | null;
  priceOnRequest: boolean;
}

/** Draft de una card de método de pago (paso Entrega y pago). */
interface PaymentDraft {
  name: string;
  icon: string;
  active: boolean;
  /** id de la fila de `payment_methods` si el preset matchea una existente. */
  existingId: number | null;
  wasActive: boolean;
  fields: PaymentFieldDef[];
  values: Record<string, string>;
}

const SHIPPING_CARDS: {
  type: ShippingMethodType;
  label: string;
  hint: string;
  icon: string;
}[] = [
  {
    type: 'pickup',
    label: 'Retiro en local',
    hint: 'El cliente pasa a buscar su pedido',
    icon: 'store',
  },
  {
    type: 'delivery',
    label: 'Entrega personal',
    hint: 'Tú llevas el pedido a la dirección del cliente',
    icon: 'map-pin',
  },
  {
    type: 'shipping',
    label: 'Envío nacional',
    hint: 'Envías por encomienda o courier',
    icon: 'truck',
  },
];

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
    PhoneMockupComponent,
    ToggleComponent,
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
  private readonly tenantService = inject(TenantService);
  private readonly profileStore = inject(ProfileStore);
  public readonly configStore = inject(EcommerceConfigStore);
  private readonly configService = inject(EcommerceConfigService);
  public readonly categoryStore = inject(CategoryStore);
  private readonly productService = inject(ProductService);

  public readonly themeColors = THEME_COLORS;
  /** Lista de pasos + índice actual: la numeración (Paso 1/3) sale de acá. */
  public readonly stepIds = STEP_IDS;
  public readonly totalSteps = STEP_IDS.length;
  public readonly stepIndex = signal(0);
  public readonly currentStep = computed<StepId>(
    () => this.stepIds[this.stepIndex()]
  );
  /** Número humano del paso actual (Paso {stepNumber}/{totalSteps}). */
  public readonly stepNumber = computed(() => this.stepIndex() + 1);
  /** true mientras redirige a /admin (onboarding ya completado): no renderiza. */
  public readonly isRedirecting = signal(false);
  /** El formulario no se muestra hasta aplicar los prefills (evita que el
   *  loadConfig asíncrono pise lo que el usuario ya tipeó). */
  public readonly isBooting = signal(true);
  private tenantId: string | null = null;

  // ── Paso 1: tu tienda ───────────────────────────────────────────────────
  public readonly whatsapp = signal('');
  public readonly countryIso = signal('ve');
  /** true si el WhatsApp ya se conoce (config o signup): el campo no se pide. */
  public readonly whatsappKnown = signal(false);
  /** true si la config ya tenía un botón de WhatsApp (no se re-guarda). */
  private hadConfigWhatsapp = false;
  private profileName = '';

  public readonly storeName = signal('');
  public readonly logoUrl = signal<string | null>(null);
  public readonly themeColor = signal('#10b981');
  public readonly slug = signal('');
  /** true si el tenant todavía tiene un slug temporal (tienda-* / mi-tienda-*):
   *  mientras lo sea, la dirección sigue al nombre al tipear. */
  public readonly isTempSlug = signal(false);
  /** Dirección editable (siempre visible en el wizard). */
  public readonly slugInput = signal('');
  private slugManuallyEdited = false;
  private initialSlug = '';

  // ── Paso 2: primer producto (+ categorías inline) ───────────────────────
  public readonly newCategoryName = signal('');
  public readonly creatingCategory = signal(false);
  public readonly productName = signal('');
  public readonly productPrice = signal<number | null>(null);
  public readonly productPhotos = signal<string[]>([]);
  public readonly productCategoryIds = signal<string[]>([]);

  // ── Paso 3: entrega y pago ──────────────────────────────────────────────
  public readonly shippingDrafts = signal<ShippingDraft[]>(
    SHIPPING_CARDS.map((card) => ({
      ...card,
      active: false,
      fee: 0,
      priceOnRequest: false,
    }))
  );
  private existingShippingMethods: ShippingMethod[] = [];

  public readonly paymentDrafts = signal<PaymentDraft[]>([]);
  private existingPaymentMethods: PaymentMethodEntity[] = [];

  public readonly isSaving = signal(false);

  public readonly isVenezuela = computed(
    () => this.countryIso().toUpperCase() === 'VE'
  );

  /** Categorías reales del catálogo (excluye la sembrada "Ver todos"). */
  public readonly categories = computed(() =>
    this.categoryStore
      .categoryList()
      .categories.filter((c) => !c.isViewAll)
  );
  public readonly categoryOptions = computed(() =>
    this.categories().map((c) => ({ id: c.id, name: c.name }))
  );

  /** Slug final del campo editable (slugificado + sin guiones en los bordes). */
  public readonly finalSlug = computed(() => toSlug(this.slugInput()));
  public readonly storeStepValid = computed(
    () =>
      this.storeName().trim().length > 0 &&
      this.whatsapp().trim().length > 0 &&
      this.finalSlug().length > 0
  );
  public readonly productValid = computed(
    () =>
      this.productName().trim().length > 0 && (this.productPrice() ?? 0) > 0
  );

  /** URL pública del catálogo (hint en vivo bajo el campo de dirección). */
  public readonly storeUrl = computed(() => {
    const slug = this.finalSlug() || this.slug();
    return slug ? `${slug}.catalogohoy.com` : '';
  });

  // ── Preview: mismo mockup (iframe del catálogo real) que Editar Catálogo ──
  private readonly sanitizer = inject(DomSanitizer);
  private readonly phoneMockup =
    viewChild<PhoneMockupComponent>('phoneMockup');
  /** Último PREVIEW_UPDATE enviado — se re-manda cuando el iframe (re)carga. */
  private lastPreviewMessage: PreviewMessage | null = null;

  /** URL del catálogo público dentro del mockup (?slug&preview=true, igual que
   *  el editor). Reacciona al slug actual (sigue funcionando tras el rename del
   *  paso 1) y al paso — el cambio de query recarga el iframe, así lo creado en
   *  cada paso (categorías/producto) aparece guardado al avanzar. */
  public readonly safeIframeUrl = computed<SafeResourceUrl | ''>(() => {
    const slug = this.slug();
    if (!slug) return '';
    const url = `${window.location.origin}/?slug=${slug}&preview=true&onbStep=${this.stepIndex()}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  constructor() {
    // Push en vivo al iframe (mismo canal postMessage del editor de catálogo):
    // nombre, logo y color se reflejan mientras se tipea. Guard de boot para
    // no pisar con nulls lo que el iframe cargó del RPC público.
    effect(() => {
      if (this.isBooting()) return;
      if (!this.phoneMockup()) return;
      const name = this.storeName().trim();
      const message: PreviewMessage = {
        type: 'PREVIEW_UPDATE',
        payload: {
          ...(name ? { name } : {}),
          logo: this.logoUrl(),
          themeColor: this.themeColor(),
        },
        source: 'catalogohoy-admin',
      };
      this.lastPreviewMessage = message;
      this.phoneMockup()?.sendPreviewMessage(message);
    });
  }

  /** Re-push del último estado al (re)cargar el iframe — igual que el editor:
   *  el frame nuevo engancha su listener al iniciar; el tick evita la carrera. */
  public onPreviewIframeLoaded(): void {
    const msg = this.lastPreviewMessage;
    if (!msg) return;
    setTimeout(() => this.phoneMockup()?.sendPreviewMessage(msg), 250);
  }

  async ngOnInit(): Promise<void> {
    const id = await this.tenantStore.getTenantIdAsync();
    if (id == null) {
      this.isBooting.set(false);
      return;
    }
    this.tenantId = String(id);

    // Guard de re-entrada: si este tenant ya completó (u omitió) el wizard,
    // directo al admin sin renderizar.
    try {
      if (localStorage.getItem(onboardingDoneKey(this.tenantId)) === '1') {
        this.isRedirecting.set(true);
        this.router.navigate(['/admin']);
        return;
      }
    } catch {
      /* ignore private-mode */
    }

    await this.configStore.loadConfig(this.tenantId);
    const config = this.configStore.config();
    const profile = this.profileStore.profile();

    // Prefills: nombre del perfil, color/logo del catálogo ya creado.
    this.profileName = (profile?.name ?? '').trim();
    this.themeColor.set(config?.themeColor || '#10b981');
    this.logoUrl.set(config?.logo ?? null);
    this.countryIso.set((config?.countryCode ?? 've').toLowerCase());

    const currentSlug = this.tenantStore.tenant().tenantSlug ?? '';
    this.slug.set(currentSlug);
    this.isTempSlug.set(isTempSlugValue(currentSlug));
    this.initialSlug = currentSlug;

    // Nombre: NO prefillear el sembrado por el trigger de signup ("Mi tienda",
    // el propio slug o un nombre con pinta de slug temporal tipo
    // "mi-tienda-mmr0ps"): input vacío con placeholder.
    const rawName = (config?.name ?? '').trim();
    const seededName =
      rawName.toLowerCase() === 'mi tienda' ||
      rawName === currentSlug ||
      /^(mi-)?tienda-[a-z0-9-]+$/.test(rawName.toLowerCase());
    this.storeName.set(seededName ? '' : rawName);
    // La dirección SIEMPRE es editable: prefill con el slug actual. Si es
    // temporal, se autogenera desde el nombre hasta que la editen a mano.
    this.slugInput.set(currentSlug);

    // ── WhatsApp ya conocido ⇒ el campo NO se vuelve a pedir ───────────────
    // Fuentes: (1) config.whatsappButtons ya guardado; (2) el signup nuevo lo
    // pide y lo deja en user_metadata.store_whatsapp (E.164) — en ese caso se
    // persiste como botón recién al confirmar el paso 1.
    const configWhatsapp =
      config?.whatsappButtons?.find((b) => b.number?.trim())?.number ?? '';
    this.hadConfigWhatsapp = configWhatsapp.length > 0;
    if (configWhatsapp) {
      this.whatsapp.set(configWhatsapp);
      this.whatsappKnown.set(true);
    } else {
      try {
        const { data } =
          await SupabaseClientProvider.getInstance().auth.getUser();
        const raw = data.user?.user_metadata?.['store_whatsapp'];
        const signupWhatsapp = typeof raw === 'string' ? raw.trim() : '';
        if (signupWhatsapp) {
          this.whatsapp.set(signupWhatsapp);
          this.whatsappKnown.set(true);
        }
      } catch {
        /* sin metadata/sesión: el campo WhatsApp se muestra en el paso 1 */
      }
    }

    this.prefillShipping(config?.shippingMethods ?? []);
    await this.loadPaymentPrefill(this.tenantId);

    this.categoryStore.categoryList$(1, 100);

    // Recién ahora se renderiza el formulario: si se mostrara antes, estos
    // prefills asíncronos pisarían lo que el usuario ya escribió.
    this.isBooting.set(false);
  }

  // ── Navegación (sobre la lista de pasos: nunca sale de rango) ───────────
  public back(): void {
    if (this.stepIndex() > 0) this.stepIndex.update((i) => i - 1);
  }

  private goNext(): void {
    if (this.stepIndex() < this.stepIds.length - 1) {
      this.stepIndex.update((i) => i + 1);
    }
  }

  public onStoreNameChange(value: string): void {
    this.storeName.set(value);
    // La dirección sigue al nombre hasta que el usuario la edite a mano.
    if (this.isTempSlug() && !this.slugManuallyEdited) {
      this.slugInput.set(toSlug(value));
    }
  }

  public onSlugInputChange(value: string): void {
    this.slugManuallyEdited = true;
    // Sanitiza mientras escribe pero SIN recortar guiones de los bordes
    // (si no, sería imposible tipear "mi-tienda"); finalSlug() recorta.
    this.slugInput.set(sanitizeSlug(value));
  }

  /** Paso 1 → renombra tienda/slug si aplica y guarda nombre/logo/color
   *  (+ WhatsApp si aún no estaba en la config) en un solo update. */
  public async saveStore(): Promise<void> {
    if (!this.storeStepValid() || this.isSaving()) return;
    this.isSaving.set(true);

    // Dirección editada ⇒ renameTenant (checkSlug adentro: si la dirección
    // está ocupada muestra el error y no avanza). Sin cambio de slug, no-op.
    const newSlug = this.finalSlug();
    if (this.tenantId && newSlug !== this.initialSlug) {
      const name = this.storeName().trim();
      const renamed = await this.tenantService.renameTenant(
        this.tenantId,
        name,
        newSlug
      );
      if (renamed.isLeft()) {
        this.toast.error(renamed.value as unknown as Exception);
        this.isSaving.set(false);
        return;
      }
      // La multi-tenancy lee 'slug' de localStorage (AppComponent lo captura
      // de los query params): reflejar el rename para las próximas queries.
      try {
        localStorage.setItem('slug', newSlug);
      } catch {
        /* ignore private-mode */
      }
      this.tenantStore.setTenantIdentity(name, newSlug);
      this.slug.set(newSlug);
      this.initialSlug = newSlug;
      this.isTempSlug.set(isTempSlugValue(newSlug));
    }

    const partial: Partial<EcommerceConfig> = {
      name: this.storeName().trim(),
      themeColor: this.themeColor(),
      logo: this.logoUrl(),
    };
    // WhatsApp del vendedor: se guarda con este mismo update cuando vino del
    // campo del paso 1 o del metadata del signup y la config aún no lo tenía.
    if (!this.hadConfigWhatsapp && this.whatsapp().trim()) {
      partial.whatsappButtons = [
        {
          name: this.profileName || 'WhatsApp',
          number: this.whatsapp().trim(),
        },
      ];
    }
    await this.configStore.updatePartialConfig(partial);
    if (partial.whatsappButtons) this.hadConfigWhatsapp = true;
    this.isSaving.set(false);
    this.goNext();
  }

  public onLogoUpload(url: string | string[]): void {
    const first = Array.isArray(url) ? url[0] : url;
    if (first) this.logoUrl.set(first);
  }

  public selectColor(color: string): void {
    this.themeColor.set(color);
  }

  // ── Paso 2: categorías inline ───────────────────────────────────────────
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

  // ── Paso 2: producto ────────────────────────────────────────────────────
  public onProductPhoto(url: string | string[]): void {
    const urls = Array.isArray(url) ? url : [url];
    this.productPhotos.update((cur) => [...cur, ...urls.filter(Boolean)]);
  }

  public removeProductPhoto(url: string): void {
    this.productPhotos.update((cur) => cur.filter((u) => u !== url));
  }

  /** Crea el primer producto y avanza al paso Entrega y pago. */
  public async saveProduct(): Promise<void> {
    if (!this.productValid() || this.isSaving()) return;
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
        this.toast.success('Producto creado');
        // Reset: si vuelve a este paso puede cargar OTRO producto sin duplicar.
        this.productName.set('');
        this.productPrice.set(null);
        this.productPhotos.set([]);
        this.productCategoryIds.set([]);
        this.isSaving.set(false);
        this.goNext();
      })
      .mapLeft((e: Error) => {
        this.toast.error(e as unknown as Exception);
        this.isSaving.set(false);
      });
  }

  /** Salta el producto sin crear y avanza al paso Entrega y pago. */
  public skipProduct(): void {
    this.goNext();
  }

  // ── Paso 3: entrega ─────────────────────────────────────────────────────
  private prefillShipping(methods: ShippingMethod[]): void {
    this.existingShippingMethods = methods;
    this.shippingDrafts.set(
      SHIPPING_CARDS.map((card) => {
        const existing = methods.find((m) => m.type === card.type);
        return {
          ...card,
          active: existing?.isActive ?? false,
          fee: existing?.fee ?? 0,
          priceOnRequest: existing?.priceOnRequest === true,
        };
      })
    );
  }

  public toggleShipping(type: ShippingMethodType): void {
    this.shippingDrafts.update((drafts) =>
      drafts.map((d) => (d.type === type ? { ...d, active: !d.active } : d))
    );
  }

  public setShippingFee(type: ShippingMethodType, fee: number | null): void {
    this.shippingDrafts.update((drafts) =>
      drafts.map((d) => (d.type === type ? { ...d, fee } : d))
    );
  }

  public setShippingOnRequest(
    type: ShippingMethodType,
    priceOnRequest: boolean
  ): void {
    this.shippingDrafts.update((drafts) =>
      drafts.map((d) =>
        d.type === type
          ? { ...d, priceOnRequest, fee: priceOnRequest ? 0 : d.fee }
          : d
      )
    );
  }

  private buildShippingMethods(): ShippingMethod[] {
    const existing = this.existingShippingMethods;
    const consumed = new Set<string>();
    let nextPosition =
      existing.reduce((max, m) => Math.max(max, m.position), -1) + 1;

    const fromDrafts: ShippingMethod[] = this.shippingDrafts().map((draft) => {
      const match = existing.find(
        (m) => m.type === draft.type && !consumed.has(m.id)
      );
      if (match) consumed.add(match.id);

      const fee = draft.priceOnRequest ? 0 : Math.max(0, draft.fee ?? 0);
      if (match) {
        return {
          ...match,
          name: match.name?.trim() ? match.name : draft.label,
          fee,
          priceOnRequest: draft.priceOnRequest,
          requestCustomerAddress:
            match.type === 'pickup' ? match.requestCustomerAddress : true,
          isActive: draft.active,
        };
      }
      return {
        id: crypto.randomUUID(),
        name: draft.label,
        type: draft.type,
        fee,
        priceOnRequest: draft.priceOnRequest,
        instructions: '',
        requestCustomerAddress: draft.type !== 'pickup',
        address: null,
        lat: null,
        lng: null,
        isActive: draft.active,
        isDefault: false,
        position: nextPosition++,
      };
    });

    const untouched = existing.filter((m) => !consumed.has(m.id));
    const all = [...fromDrafts, ...untouched].sort(
      (a, b) => a.position - b.position
    );

    // El primero activo es el default; el resto no.
    let defaultAssigned = false;
    return all.map((m) => {
      const isDefault = m.isActive && !defaultAssigned;
      if (isDefault) defaultAssigned = true;
      return { ...m, isDefault };
    });
  }

  // ── Paso 3: pago ────────────────────────────────────────────────────────
  private paymentPresets(): { name: string; icon: string }[] {
    return this.isVenezuela()
      ? [
          { name: 'Pago móvil', icon: 'smartphone' },
          { name: 'Transferencia', icon: 'building' },
          { name: 'Zelle', icon: 'dollar-sign' },
          { name: 'Efectivo', icon: 'banknote' },
        ]
      : [
          { name: 'Transferencia', icon: 'building' },
          { name: 'Zelle', icon: 'dollar-sign' },
          { name: 'PayPal', icon: 'globe' },
          { name: 'Efectivo', icon: 'banknote' },
        ];
  }

  /** Lee los métodos existentes (tabla `payment_methods`) para prefill; los
   *  presets matchean por nombre normalizado y, si no, por tipo inferido. */
  private async loadPaymentPrefill(tenantId: string): Promise<void> {
    const result = await this.configService.getPaymentMethods(tenantId);
    this.existingPaymentMethods = result.isRight() ? result.value : [];

    const consumed = new Set<number>();
    const drafts = this.paymentPresets().map((preset) => {
      const presetName = normalizeName(preset.name);
      const presetType = detectPaymentMethodType(preset.name);
      const match =
        this.existingPaymentMethods.find(
          (m) => !consumed.has(m.id) && normalizeName(m.name) === presetName
        ) ??
        this.existingPaymentMethods.find(
          (m) =>
            !consumed.has(m.id) &&
            presetType !== 'otro' &&
            detectPaymentMethodType(m.name) === presetType
        ) ??
        null;
      if (match) consumed.add(match.id);

      const fields = paymentMethodFields(preset.name, this.isVenezuela()).slice(
        0,
        3
      );
      const values: Record<string, string> = {};
      for (const field of fields) {
        values[field.key] = match?.details?.[field.key] ?? '';
      }
      return {
        name: preset.name,
        icon: match?.icon ?? preset.icon,
        active: match?.isActive ?? false,
        existingId: match?.id ?? null,
        wasActive: match?.isActive ?? false,
        fields,
        values,
      };
    });
    this.paymentDrafts.set(drafts);
  }

  public togglePayment(index: number): void {
    this.paymentDrafts.update((drafts) =>
      drafts.map((d, i) => (i === index ? { ...d, active: !d.active } : d))
    );
  }

  public setPaymentValue(index: number, key: string, value: string): void {
    this.paymentDrafts.update((drafts) =>
      drafts.map((d, i) =>
        i === index ? { ...d, values: { ...d.values, [key]: value } } : d
      )
    );
  }

  /** Paso 3 (final) → guarda entrega + métodos de pago y termina el wizard. */
  public async finishSetup(): Promise<void> {
    if (this.isSaving()) return;
    this.isSaving.set(true);

    const shippingMethods = this.buildShippingMethods();
    await this.configStore.updatePartialConfig({
      shippingMethods,
      showShippingSection: shippingMethods.some((m) => m.isActive),
    });
    this.existingShippingMethods = shippingMethods;

    const saved = await this.savePaymentMethods();
    this.isSaving.set(false);
    if (!saved) return;
    this.toast.success('¡Tu tienda está lista!');
    this.complete();
  }

  /** Persiste los presets en la tabla `payment_methods` (la que lee el
   *  checkout): activos → upsert con details; apagados que estaban activos →
   *  is_active=false; los preexistentes no tocados quedan como están. */
  private async savePaymentMethods(): Promise<boolean> {
    const tenantId = this.tenantId;
    if (!tenantId) return true;

    for (const draft of this.paymentDrafts()) {
      if (draft.existingId != null) {
        if (draft.active) {
          const result = await this.configService.updatePaymentMethod(
            draft.existingId,
            { is_active: true, details: this.draftDetails(draft) }
          );
          if (result.isLeft()) return this.paymentSaveFailed(result.value);
        } else if (draft.wasActive) {
          const result = await this.configService.updatePaymentMethod(
            draft.existingId,
            { is_active: false }
          );
          if (result.isLeft()) return this.paymentSaveFailed(result.value);
        }
      } else if (draft.active) {
        const created = await this.configService.createPaymentMethod(
          tenantId,
          draft.name,
          draft.icon
        );
        if (created.isLeft()) return this.paymentSaveFailed(created.value);
        // Registrar el id creado en el draft: si un paso posterior falla y el
        // usuario reintenta Finalizar, se actualiza en vez de duplicar.
        const createdId = created.value.id;
        this.existingPaymentMethods = [
          ...this.existingPaymentMethods,
          created.value,
        ];
        this.paymentDrafts.update((drafts) =>
          drafts.map((d) =>
            d.name === draft.name ? { ...d, existingId: createdId } : d
          )
        );
        const result = await this.configService.updatePaymentMethod(
          createdId,
          { is_active: true, details: this.draftDetails(draft) }
        );
        if (result.isLeft()) return this.paymentSaveFailed(result.value);
      }
    }
    return true;
  }

  /** Merge de details: conserva claves existentes no mostradas y solo guarda
   *  los campos con valor (los vaciados se quitan). */
  private draftDetails(draft: PaymentDraft): Record<string, string> {
    const existing = this.existingPaymentMethods.find(
      (m) => m.id === draft.existingId
    );
    const details: Record<string, string> = { ...(existing?.details ?? {}) };
    for (const field of draft.fields) {
      const value = (draft.values[field.key] ?? '').trim();
      if (value) details[field.key] = value;
      else delete details[field.key];
    }
    return details;
  }

  private paymentSaveFailed(error: Error): false {
    this.toast.error(error as unknown as Exception);
    return false;
  }

  /** "Saltar" del paso final: marca el flag y va al admin SIN guardar
   *  entrega/pago ni toast — el checklist del Inicio queda de recordatorio. */
  public skipAll(): void {
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

    // Si la tienda se renombró y estamos en el subdominio del slug temporal
    // (prod: cada tenant vive en <slug>.catalogohoy.com), el host viejo dejó
    // de resolver a un slug válido. Saltamos al subdominio nuevo llevando la
    // sesión por query param (mismo handoff que usa el login entre orígenes).
    const slug = this.slug().trim();
    const target = `${slug}.catalogohoy.com`;
    if (
      !isDevMode() &&
      slug &&
      window.location.hostname.endsWith('.catalogohoy.com') &&
      window.location.hostname !== target
    ) {
      const key = authenticationTokenService.AUTH_CONFIG_KEY;
      const value = encodeURIComponent(authenticationTokenService.authConfigValue ?? '');
      window.location.href = `https://${target}/admin?${key}=${value}`;
      return;
    }

    this.router.navigate(['/admin']);
  }
}

/** Slugifica sin recortar guiones en los bordes (para sanear mientras se
 *  escribe): lowercase, sin acentos, no-alfanuméricos → '-'. */
function sanitizeSlug(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-');
}

/** Slug final: igual que sanitizeSlug + trim de '-' en los bordes. Mismo
 *  resultado que translate(ÁÉÍÓÚáéíóúÑñ→AEIOUaeiouNn) del trigger de DB. */
function toSlug(value: string): string {
  return sanitizeSlug(value).replace(/^-+|-+$/g, '');
}

/** Normaliza un nombre para matchear presets de pago: lowercase, sin acentos
 *  ("Pago móvil" matchea la fila sembrada "Pago movil"). */
function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}
