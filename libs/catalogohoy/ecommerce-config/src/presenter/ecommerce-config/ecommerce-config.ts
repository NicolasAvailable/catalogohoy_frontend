import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { PlanStore } from '@catalogohoy/plan';
import { TenantStore, getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import {
  ButtonComponent,
  CardComponent,
  ColorPickerComponent,
  ConfirmDialogService,
  IconComponent,
  InputPhoneComponent,
  InputTextComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
  TextareaComponent,
  ToggleComponent,
  UploaderComponent,
} from '@ui';
import { Observable } from 'rxjs';
import {
  CatalogTemplate,
  DEFAULT_CURRENCY_CONFIG,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_WHATSAPP_ORDER_MESSAGE,
  EcommerceConfig,
  ExchangeRateType,
  findCountryByCode,
  SocialLinks,
  SUPPORTED_COUNTRIES,
  SUPPORTED_CURRENCIES,
  TenantCurrencyConfig,
  THEME_COLORS,
  WHATSAPP_MESSAGE_MAX_LENGTH,
  WHATSAPP_MESSAGE_VARIABLES,
  WhatsappButton,
} from '../../domain';
import { EcommerceConfigStore, LocationApiService, TenantCurrencyStore } from '../../infrastructure';
import { PhoneMockupComponent } from '../components/phone-mockup/phone-mockup';
import { TemplateSelectorComponent } from '../components/template-selector/template-selector';

@Component({
  selector: 'lib-ecommerce-config',
  imports: [
    FormsModule,
    ButtonComponent,
    InputTextComponent,
    InputPhoneComponent,
    ToggleComponent,
    IconComponent,
    CardComponent,
    UploaderComponent,
    TextareaComponent,
    ColorPickerComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
    PhoneMockupComponent,
    TemplateSelectorComponent,
  ],
  templateUrl: './ecommerce-config.html',
  styleUrl: './ecommerce-config.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcommerceConfigComponent implements OnInit {
  public readonly tenantStore = inject(TenantStore);
  public readonly configStore = inject(EcommerceConfigStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly permissions = inject(TeamPermissionsStore);
  protected readonly canEditCatalog = computed(() => this.permissions.isOwner() || this.permissions.can()('catalogo', 'edit'));
  private readonly planStore = inject(PlanStore);
  public readonly isWhatsappLocked = computed(() => this.planStore.currentPlan()?.isFree ?? false);

  public readonly themeColors = THEME_COLORS;
  public readonly supportedCountries = SUPPORTED_COUNTRIES;
  public readonly supportedCurrencies = SUPPORTED_CURRENCIES;
  private readonly locationApi = inject(LocationApiService);

  // Location cascade signals
  public readonly availableStates = signal<string[]>([]);
  public readonly availableCities = signal<string[]>([]);
  public readonly isLoadingStates = signal(false);
  public readonly isLoadingCities = signal(false);

  // New payment method form
  public readonly newMethodName = signal('');
  public readonly newMethodIcon = signal('wallet');
  public readonly isAddingMethod = signal(false);

  public readonly iconOptions: { label: string; value: string }[] = [
    { label: 'Billetera', value: 'wallet' },
    { label: 'Billetes', value: 'banknote' },
    { label: 'Tarjeta', value: 'credit-card' },
    { label: 'Teléfono', value: 'smartphone' },
    { label: 'Banco', value: 'building' },
    { label: 'Dólar', value: 'dollar-sign' },
    { label: 'Rayo', value: 'zap' },
    { label: 'Monedas', value: 'coins' },
    { label: 'Candado', value: 'lock' },
    { label: 'Globo', value: 'globe' },
  ];

  // WhatsApp message template
  public readonly whatsappMessageVariables = WHATSAPP_MESSAGE_VARIABLES;
  public readonly defaultWhatsappMessage = DEFAULT_WHATSAPP_ORDER_MESSAGE;
  public readonly whatsappMaxLength = WHATSAPP_MESSAGE_MAX_LENGTH;
  public readonly whatsappMessageTextarea = viewChild<ElementRef>('whatsappMessageTextarea');

  // Draft signals
  public readonly draftName = signal('');
  public readonly draftDescription = signal('');
  public readonly draftWhatsappButtons = signal<WhatsappButton[]>([]);
  public readonly draftThemeColor = signal('#10b981');
  public readonly draftCountryCode = signal<string | null>(null);
  public readonly draftState = signal<string | null>(null);
  public readonly draftCity = signal<string | null>(null);
  public readonly draftShowDesignSection = signal(true);
  public readonly draftShowLocationSection = signal(true);
  public readonly draftShowPaymentMethodsSection = signal(true);
  public readonly draftSocialLinks = signal<SocialLinks>({ ...DEFAULT_SOCIAL_LINKS });
  public readonly draftTemplate = signal<CatalogTemplate>('banner-centered');
  public readonly draftCurrencySymbol = signal('$');
  public readonly draftShowReferencePrice = signal(true);
  public readonly draftShowLocalCurrencyPrice = signal(true);
  public readonly draftWhatsappOrderMessage = signal<string | null>(null);

  // Currency config drafts — TenantCurrencyConfig shape
  public readonly draftCurrency = signal<TenantCurrencyConfig>({ ...DEFAULT_CURRENCY_CONFIG });
  public readonly isVenezuela = computed(
    () => this.draftCountryCode() === 'VE'
  );

  // Computed
  public readonly isCustomColor = computed(
    () => !this.themeColors.some((c) => c.value === this.draftThemeColor())
  );
  public readonly hasUnsavedChanges = computed(() => {
    const config = this.configStore.config();
    if (!config) return false;
    if (Object.keys(this.getChangedFields()).length > 0) return true;

    // Country (lives on tenants)
    if (this.draftCountryCode() !== (config.countryCode ?? null)) return true;

    // Currency config (lives on tenant_currency_config)
    const cc = this.configStore.currencyConfig();
    const dc = this.draftCurrency();
    const currencyKeys: (keyof TenantCurrencyConfig)[] = [
      'productCurrency', 'displayCurrency', 'exchangeRateType',
      'customRate', 'showDualCurrency', 'currencySymbol',
      'decimalSeparator', 'thousandSeparator',
    ];
    return currencyKeys.some((k) => dc[k] !== cc[k]);
  });

  // Responsive label for top save button
  public readonly saveButtonTopLabel = signal('Guardar cambios');

  // Mobile overlay
  public readonly isMockupOpen = signal(false);

  // iframe URL
  public safeIframeUrl: SafeResourceUrl = '';

  // Tracks the last config snapshot used to sync drafts
  private lastSyncedConfig: EcommerceConfig | null = null;

  // Save button visibility tracking
  private readonly topSaveAnchor = viewChild<ElementRef>('topSaveAnchor');
  private readonly bottomSaveAnchor = viewChild<ElementRef>('bottomSaveAnchor');
  private readonly mainColumn = viewChild<ElementRef>('mainColumn');
  private readonly isTopSaveVisible = signal(true);
  private readonly isBottomSaveVisible = signal(false);
  public readonly showStickyBanner = computed(
    () => this.hasUnsavedChanges() && this.canEditCatalog() && !this.isTopSaveVisible() && !this.isBottomSaveVisible()
  );

  // Phone mockup refs
  public readonly phoneMockup = viewChild<PhoneMockupComponent>('phoneMockup');
  public readonly phoneMockupOverlay =
    viewChild<PhoneMockupComponent>('phoneMockupOverlay');

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // Responsive save button label
    const mq = window.matchMedia('(min-width: 640px)');
    const updateLabel = (matches: boolean) =>
      this.saveButtonTopLabel.set(matches ? 'Guardar cambios' : 'Guardar');
    updateLabel(mq.matches);
    const handler = (e: MediaQueryListEvent) => updateLabel(e.matches);
    mq.addEventListener('change', handler);
    this.destroyRef.onDestroy(() => mq.removeEventListener('change', handler));

    // Intersection observer for save button visibility
    effect((onCleanup) => {
      const topEl = this.topSaveAnchor()?.nativeElement;
      const bottomEl = this.bottomSaveAnchor()?.nativeElement;
      const scrollContainer = this.mainColumn()?.nativeElement;
      if (!scrollContainer) return;

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.target === topEl) this.isTopSaveVisible.set(entry.isIntersecting);
            if (entry.target === bottomEl) this.isBottomSaveVisible.set(entry.isIntersecting);
          }
        },
        { root: scrollContainer, threshold: 0 }
      );

      if (topEl) observer.observe(topEl);
      if (bottomEl) observer.observe(bottomEl);
      onCleanup(() => observer.disconnect());
    });

    // Sync drafts from server config (selective: preserves user-modified fields)
    // IMPORTANT: Draft signals are read with untracked() to avoid circular dependencies.
    // This effect must ONLY react to configStore.config() changes.
    effect(() => {
      const config = this.configStore.config();
      if (!config) return;

      const prev = this.lastSyncedConfig;
      const isFirstLoad = !prev;

      // Helper: only update a draft if user hasn't modified it since last sync
      // Uses untracked() to read drafts without registering them as dependencies
      const syncField = <T>(draft: { (): T; set: (v: T) => void }, prevVal: T, newVal: T) => {
        const currentVal = untracked(() => draft());
        if (isFirstLoad || currentVal === prevVal) {
          if (currentVal !== newVal) draft.set(newVal);
        }
      };

      const syncFieldJson = <T>(draft: { (): T; set: (v: T) => void }, prevVal: T, newVal: T) => {
        const currentVal = untracked(() => draft());
        const currentJson = JSON.stringify(currentVal);
        if (isFirstLoad || currentJson === JSON.stringify(prevVal)) {
          if (currentJson !== JSON.stringify(newVal)) draft.set(newVal);
        }
      };

      const prevButtons = prev?.whatsappButtons?.length
        ? prev.whatsappButtons
        : [{ name: '', number: '' }];
      const newButtons = config.whatsappButtons?.length
        ? config.whatsappButtons.map((b) => ({ ...b }))
        : [{ name: '', number: '' }];

      syncField(this.draftName, prev?.name ?? '', config.name ?? '');
      syncField(this.draftDescription, prev?.description ?? '', config.description ?? '');
      syncField(this.draftThemeColor, prev?.themeColor ?? '#10b981', config.themeColor ?? '#10b981');
      syncField(this.draftCountryCode, prev?.countryCode ?? null, config.countryCode ?? null);
      syncField(this.draftState, prev?.state ?? null, config.state ?? null);
      syncField(this.draftCity, prev?.city ?? null, config.city ?? null);
      syncField(this.draftShowDesignSection, prev?.showDesignSection ?? true, config.showDesignSection ?? true);
      syncField(this.draftShowLocationSection, prev?.showLocationSection ?? true, config.showLocationSection ?? true);
      syncField(this.draftShowPaymentMethodsSection, prev?.showPaymentMethodsSection ?? true, config.showPaymentMethodsSection ?? true);
      syncField(this.draftTemplate, prev?.template ?? 'banner-centered' as CatalogTemplate, config.template ?? 'banner-centered' as CatalogTemplate);
      syncField(this.draftCurrencySymbol, prev?.currencySymbol ?? '$', config.currencySymbol ?? '$');
      syncField(this.draftShowReferencePrice, prev?.showReferencePrice ?? true, config.showReferencePrice ?? true);
      syncField(this.draftShowLocalCurrencyPrice, prev?.showLocalCurrencyPrice ?? true, config.showLocalCurrencyPrice ?? true);
      syncField(this.draftWhatsappOrderMessage, prev?.whatsappOrderMessage ?? null, config.whatsappOrderMessage ?? null);
      syncFieldJson(this.draftWhatsappButtons, prevButtons, newButtons);
      syncFieldJson(this.draftSocialLinks, prev?.socialLinks ?? DEFAULT_SOCIAL_LINKS, config.socialLinks ?? { ...DEFAULT_SOCIAL_LINKS });

      this.lastSyncedConfig = { ...config };
    });

    // Send preview messages when drafts change
    effect(() => {
      const name = this.draftName();
      const themeColor = this.draftThemeColor();
      const showDesignSection = this.draftShowDesignSection();
      const socialLinks = this.draftSocialLinks();
      const template = this.draftTemplate();
      const currencySymbol = this.draftCurrencySymbol();
      const showReferencePrice = this.draftShowReferencePrice();
      const showLocalCurrencyPrice = this.draftShowLocalCurrencyPrice();
      // Read draftCurrency so the effect re-fires when the user picks
      // a different reference currency (USD/EUR) via setReferenceCurrency.
      const currencyConfig = this.draftCurrency();
      // Location drafts — so the public footer updates live when the user
      // changes country/state/city in the editor.
      const countryCode = this.draftCountryCode();
      const country = findCountryByCode(countryCode)?.label ?? null;
      const state = this.draftState();
      const city = this.draftCity();
      const showLocationSection = this.draftShowLocationSection();
      const logo = this.configStore.config()?.logo ?? null;
      const banner = this.configStore.config()?.banner ?? null;

      const message = {
        type: 'PREVIEW_UPDATE' as const,
        payload: {
          name,
          logo,
          banner,
          themeColor,
          showDesignSection,
          socialLinks,
          template,
          currencySymbol,
          showReferencePrice,
          showLocalCurrencyPrice,
          currencyConfig,
          country,
          countryCode,
          state,
          city,
          showLocationSection,
        },
        source: 'catalogohoy-admin' as const,
      };

      this.phoneMockup()?.sendPreviewMessage(message);
      this.phoneMockupOverlay()?.sendPreviewMessage(message);
    });

    // Load states whenever the country changes.
    effect(() => {
      const code = this.draftCountryCode();
      const country = findCountryByCode(code);
      if (!country) {
        this.availableStates.set([]);
        return;
      }
      this.isLoadingStates.set(true);
      this.locationApi.getStates(country.name).then((result) => {
        result.fold(
          () => this.availableStates.set([]),
          (states) => this.availableStates.set(states)
        );
        this.isLoadingStates.set(false);
      });
    });

    // Load cities whenever the state changes (only if country is resolved).
    effect(() => {
      const code = this.draftCountryCode();
      const state = this.draftState();
      const country = findCountryByCode(code);
      if (!country || !state) {
        this.availableCities.set([]);
        return;
      }
      this.isLoadingCities.set(true);
      this.locationApi.getCities(country.name, state).then((result) => {
        result.fold(
          () => this.availableCities.set([]),
          (cities) => this.availableCities.set(cities)
        );
        this.isLoadingCities.set(false);
      });
    });

    // Sync currency config from the store into the draft.
    // If no row exists in DB yet, seed the draft from the country's
    // default currency so VE users see VES/USD-ref out of the box.
    effect(() => {
      const cc = this.configStore.currencyConfig();
      const exists = this.configStore.currencyConfigExists();
      const countryCode = this.configStore.config()?.countryCode ?? null;
      untracked(() => {
        // Seed from country defaults when:
        // - No persisted row yet, OR
        // - VE tenant still has the old USD default that should be VES
        const needsVeSeed =
          countryCode === 'VE' &&
          cc.productCurrency === 'USD' &&
          cc.exchangeRateType === 'none';

        if ((!exists || needsVeSeed) && countryCode) {
          const seeded = this.buildCurrencyDefaultsForCountry(countryCode);
          if (seeded) {
            this.draftCurrency.set(seeded);
            // Sync the old currency_symbol field so the public catalog
            // shows the right symbol ($ for VE/USD reference, etc.)
            if (countryCode === 'VE') {
              const refSymbol = seeded.displayCurrency === 'EUR' ? '€' : '$';
              this.draftCurrencySymbol.set(refSymbol);
            }
            return;
          }
        }
        this.draftCurrency.set({ ...cc });
      });
    });
  }

  private buildCurrencyDefaultsForCountry(
    code: string
  ): TenantCurrencyConfig | null {
    const country = findCountryByCode(code);
    if (!country) return null;

    if (code === 'VE') {
      return {
        productCurrency: 'VES',
        displayCurrency: 'USD',
        exchangeRateType: 'bcv_usd',
        customRate: null,
        showDualCurrency: true,
        currencySymbol: 'Bs.',
        decimalSeparator: ',',
        thousandSeparator: '.',
      };
    }

    return {
      productCurrency: country.defaultCurrency,
      displayCurrency: country.defaultCurrency,
      exchangeRateType: 'none',
      customRate: null,
      showDualCurrency: false,
      currencySymbol: SUPPORTED_CURRENCIES.find((c) => c.code === country.defaultCurrency)?.symbol ?? '$',
      decimalSeparator: country.decimalSeparator,
      thousandSeparator: country.thousandSeparator,
    };
  }

  // Flag CDN — ISO2 lowercase, free, no auth. Used in country select templates.
  flagUrl(code: string | null | undefined): string {
    if (!code) return '';
    return `https://flagcdn.com/w40/${code.toLowerCase()}.png`;
  }

  // --- Location cascade handlers ---
  onCountryChange(code: string | null) {
    const prev = this.draftCountryCode();
    if (prev === code) return;
    this.draftCountryCode.set(code);
    // Reset state + city when country changes
    this.draftState.set(null);
    this.draftCity.set(null);
    // Seed currency defaults from the new country (same helper as initial sync)
    if (code) {
      const seeded = this.buildCurrencyDefaultsForCountry(code);
      if (seeded) {
        this.draftCurrency.set(seeded);
        // Sync the old currency_symbol so preview + public catalog update.
        // VE: reference symbol ($, €). Others: local symbol.
        if (code === 'VE') {
          this.draftCurrencySymbol.set(seeded.displayCurrency === 'EUR' ? '€' : '$');
        } else {
          const sym = SUPPORTED_CURRENCIES.find((c) => c.code === seeded.productCurrency)?.symbol ?? '$';
          this.draftCurrencySymbol.set(sym);
        }
      }
    }
  }

  // Venezuela-only: quick-toggle between USD and EUR as the reference currency.
  // Mirrors the pre-internationalization UX (two buttons with symbol + name).
  // Also syncs `draftCurrencySymbol` — the old field in tenant_ecommerce_config
  // that the public catalog still reads for price rendering.
  setReferenceCurrency(code: 'USD' | 'EUR') {
    const symbol = code === 'USD' ? '$' : '€';
    this.draftCurrency.set({
      ...this.draftCurrency(),
      displayCurrency: code,
      exchangeRateType: code === 'USD' ? 'bcv_usd' : 'bcv_eur',
      showDualCurrency: true,
    });
    this.draftCurrencySymbol.set(symbol);
  }

  onStateChange(state: string | null) {
    if (this.draftState() === state) return;
    this.draftState.set(state);
    this.draftCity.set(null);
  }

  onCityChange(city: string | null) {
    this.draftCity.set(city);
  }

  // --- Currency section handlers ---
  updateCurrencyField<K extends keyof TenantCurrencyConfig>(
    key: K,
    value: TenantCurrencyConfig[K]
  ) {
    this.draftCurrency.set({ ...this.draftCurrency(), [key]: value });
  }

  async ngOnInit() {
    const slug = getTenantSlugFromUrl();
    if (slug) {
      const url = `${window.location.origin}/?slug=${slug}&preview=true`;
      this.safeIframeUrl =
        this.sanitizer.bypassSecurityTrustResourceUrl(url);
    }

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) {
      this.configStore.reloadConfig(String(tenantId));
      this.configStore.loadPaymentMethods(String(tenantId));
      this.configStore.loadCurrencyConfig(String(tenantId));
    }
  }

  // --- Unified Save ---
  getChangedFields(): Partial<EcommerceConfig> {
    const config = this.configStore.config();
    if (!config) return {};

    const changes: Partial<EcommerceConfig> = {};

    if (this.draftName() !== (config.name ?? '')) changes.name = this.draftName();
    if (this.draftDescription() !== (config.description ?? '')) changes.description = this.draftDescription();
    if (this.draftTemplate() !== (config.template ?? 'banner-centered')) changes.template = this.draftTemplate();
    if (this.draftThemeColor() !== (config.themeColor ?? '#10b981')) changes.themeColor = this.draftThemeColor();
    if (this.draftState() !== (config.state ?? null)) changes.state = this.draftState();
    if (this.draftCity() !== (config.city ?? null)) changes.city = this.draftCity();
    // country lives on `tenants` — handled by a separate saveTenantCountry call
    // in saveAllChanges, not through updateConfig.
    if (this.draftShowDesignSection() !== (config.showDesignSection ?? true)) changes.showDesignSection = this.draftShowDesignSection();
    if (this.draftShowLocationSection() !== (config.showLocationSection ?? true)) changes.showLocationSection = this.draftShowLocationSection();
    if (this.draftShowPaymentMethodsSection() !== (config.showPaymentMethodsSection ?? true)) changes.showPaymentMethodsSection = this.draftShowPaymentMethodsSection();
    if (this.draftCurrencySymbol() !== (config.currencySymbol ?? '$')) changes.currencySymbol = this.draftCurrencySymbol();
    if (this.draftShowReferencePrice() !== (config.showReferencePrice ?? true)) changes.showReferencePrice = this.draftShowReferencePrice();
    if (this.draftShowLocalCurrencyPrice() !== (config.showLocalCurrencyPrice ?? true)) changes.showLocalCurrencyPrice = this.draftShowLocalCurrencyPrice();
    if (this.draftWhatsappOrderMessage() !== (config.whatsappOrderMessage ?? null)) changes.whatsappOrderMessage = this.draftWhatsappOrderMessage();

    const serverButtons = config.whatsappButtons?.length
      ? config.whatsappButtons
      : [{ name: '', number: '' }];
    if (JSON.stringify(this.draftWhatsappButtons()) !== JSON.stringify(serverButtons)) {
      changes.whatsappButtons = this.draftWhatsappButtons();
    }

    const serverSocialLinks = config.socialLinks ?? DEFAULT_SOCIAL_LINKS;
    if (JSON.stringify(this.draftSocialLinks()) !== JSON.stringify(serverSocialLinks)) {
      changes.socialLinks = this.draftSocialLinks();
    }

    return changes;
  }

  async saveAllChanges() {
    const config = this.configStore.config();
    const changes = this.getChangedFields();

    // 1. Country lives on tenants → separate call.
    // Persist the Spanish label as `tenants.country` so it renders directly
    // in the public catalog without needing client-side translation.
    const newCountryCode = this.draftCountryCode();
    if (config && newCountryCode && newCountryCode !== (config.countryCode ?? null)) {
      const country = findCountryByCode(newCountryCode);
      if (country) {
        await this.configStore.saveTenantCountry(country.label, country.code);
      }
    }

    // 2. Currency config lives on tenant_currency_config → separate call
    const currentCurrency = this.configStore.currencyConfig();
    const draftCurrency = this.draftCurrency();
    const currencyPatch: Partial<TenantCurrencyConfig> = {};
    (Object.keys(draftCurrency) as (keyof TenantCurrencyConfig)[]).forEach((key) => {
      if (draftCurrency[key] !== currentCurrency[key]) {
        (currencyPatch as Record<string, unknown>)[key] = draftCurrency[key];
      }
    });
    if (Object.keys(currencyPatch).length > 0) {
      await this.configStore.saveCurrencyConfig(currencyPatch);
    }

    // 3. Everything else goes through updateConfig
    if (Object.keys(changes).length > 0) {
      await this.configStore.updatePartialConfig(changes);
    }

    // 4. Refresh the TenantCurrencyStore cache + localStorage so every
    //    admin view (home, orders, create order, etc.) picks up the new
    //    currency without a reload. Skipped when there was no meaningful
    //    currency/country change, since localStorage already has the
    //    current values.
    const tenantId = config?.tenantId;
    if (tenantId) {
      const cc = this.configStore.currencyConfig();
      const finalCode = this.draftCurrencyCode();
      this.tenantCurrency.setCurrency(tenantId, {
        localCode: cc.productCurrency,
        localSymbol: cc.currencySymbol,
        countryCode: finalCode,
      });
    }
  }

  private draftCurrencyCode(): string | null {
    return this.draftCountryCode() ?? this.configStore.config()?.countryCode ?? null;
  }

  showUnsavedChangesDialog(): Observable<boolean> {
    return new Observable<boolean>((subscriber) => {
      let resolved = false;
      const resolve = (value: boolean) => {
        if (resolved) return;
        resolved = true;
        subscriber.next(value);
        subscriber.complete();
      };

      this.confirmDialogService
        .info({
          headerLabel: 'Cambios sin guardar',
          contentLabel: 'Tienes cambios sin guardar. ¿Deseas guardarlos antes de salir?',
          acceptLabel: 'Guardar y salir',
          rejectLabel: 'Descartar y salir',
          rejectSeverity: 'danger',
          closable: true,
          dismissableMask: false,
          onClose: () => resolve(false),
        })
        .subscribe((result) => {
          result.fold(
            () => resolve(true),
            async () => {
              await this.saveAllChanges();
              resolve(true);
            }
          );
        });
    });
  }

  // --- Template Section ---
  selectTemplate(template: CatalogTemplate) {
    this.draftTemplate.set(template);
  }

  // --- Design Section ---
  onLogoUrlChange(url: string | string[]) {
    if (typeof url === 'string') {
      this.configStore.updateLogoUrl(url);
    }
  }

  onBannerUrlChange(url: string | string[]) {
    if (typeof url === 'string') {
      this.configStore.updateBannerUrl(url);
    }
  }

  removeLogo() {
    this.configStore.updateLogoUrl('');
  }

  removeBanner() {
    this.configStore.updateBannerUrl('');
  }

  // --- Theme Color ---
  selectThemeColor(color: string) {
    this.draftThemeColor.set(color);
  }

  // --- Payment Methods ---
  async addPaymentMethod() {
    const name = this.newMethodName().trim();
    if (!name || this.isAddingMethod()) return;
    this.isAddingMethod.set(true);
    await this.configStore.addPaymentMethod(name, this.newMethodIcon());
    this.newMethodName.set('');
    this.newMethodIcon.set('wallet');
    this.isAddingMethod.set(false);
  }

  toggleMethodActive(id: number, isActive: boolean) {
    this.configStore.togglePaymentMethodActive(id, isActive);
  }

  deleteMethod(id: number, name: string) {
    this.confirmDialogService
      .warning({
        headerLabel: '¿Eliminar método de pago?',
        contentLabel: `¿Estás seguro de eliminar "${name}"? Esta acción no se puede deshacer.`,
        acceptLabel: 'Eliminar',
        rejectLabel: 'Cancelar',
      })
      .subscribe((result) => {
        result.fold(
          () => {},
          () => this.configStore.removePaymentMethod(id)
        );
      });
  }

  // --- WhatsApp Section ---
  addWhatsappButton() {
    const current = this.draftWhatsappButtons();
    if (current.length >= 3) return;
    this.draftWhatsappButtons.set([...current, { name: '', number: '' }]);
  }

  removeWhatsappButton(index: number) {
    const current = this.draftWhatsappButtons();
    this.draftWhatsappButtons.set(current.filter((_, i) => i !== index));
  }

  updateButtonName(index: number, name: string) {
    const current = this.draftWhatsappButtons();
    const updated = current.map((b, i) => (i === index ? { ...b, name } : b));
    this.draftWhatsappButtons.set(updated);
  }

  updateButtonNumber(index: number, number: string) {
    const current = this.draftWhatsappButtons();
    const updated = current.map((b, i) =>
      i === index ? { ...b, number } : b
    );
    this.draftWhatsappButtons.set(updated);
  }

  // --- Social Links Section ---
  updateSocialLinkUrl(network: keyof SocialLinks, url: string) {
    const current = this.draftSocialLinks();
    this.draftSocialLinks.set({ ...current, [network]: { ...current[network], url } });
  }

  updateSocialLinkVisible(network: keyof SocialLinks, visible: boolean) {
    const current = this.draftSocialLinks();
    this.draftSocialLinks.set({ ...current, [network]: { ...current[network], visible } });
  }

  // --- Behavior Section ---
  onToggleOrders(enabled: boolean) {
    this.configStore.updateIsAcceptingOrders(enabled);
  }

  resetWhatsappMessage() {
    this.draftWhatsappOrderMessage.set(null);
  }

  insertVariable(variable: string) {
    const current = this.draftWhatsappOrderMessage() ?? this.defaultWhatsappMessage;
    const textarea = this.whatsappMessageTextarea()?.nativeElement as
      | HTMLTextAreaElement
      | undefined;

    if (textarea) {
      const start = textarea.selectionStart ?? current.length;
      const end = textarea.selectionEnd ?? current.length;
      const updated =
        current.slice(0, start) + variable + current.slice(end);
      this.draftWhatsappOrderMessage.set(updated);

      // Restore cursor right after the inserted variable
      requestAnimationFrame(() => {
        const pos = start + variable.length;
        textarea.focus();
        textarea.setSelectionRange(pos, pos);
      });
    } else {
      this.draftWhatsappOrderMessage.set(current + variable);
    }
  }

  get whatsappMessageLength(): number {
    return (
      this.draftWhatsappOrderMessage() ?? this.defaultWhatsappMessage
    ).length;
  }

  // --- Mobile ---
  openMockup() {
    this.isMockupOpen.set(true);
  }

  closeMockup() {
    this.isMockupOpen.set(false);
  }

  isSavingSection(section: string): boolean {
    return (
      this.configStore.isSaving() &&
      this.configStore.savingSection() === section
    );
  }
}
