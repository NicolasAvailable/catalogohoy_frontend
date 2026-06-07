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
import { ActivatedRoute, Router } from '@angular/router';
import { DatePickerModule } from 'primeng/datepicker';
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
import { toast } from 'ngx-sonner';
import { Observable } from 'rxjs';
import {
  BusinessHoursWeek,
  CatalogTemplate,
  DAY_LABELS_ES,
  DEFAULT_BUSINESS_HOURS_WEEK,
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
import {
  EcommerceConfigService,
  EcommerceConfigStore,
  LocationApiService,
  TenantCurrencyStore,
} from '../../infrastructure';
import { PhoneMockupComponent } from '../components/phone-mockup/phone-mockup';
import { TemplateSelectorComponent } from '../components/template-selector/template-selector';

export type TabId = 'general' | 'location' | 'payments' | 'social' | 'notifications';
const VALID_TABS: TabId[] = ['general', 'location', 'payments', 'social', 'notifications'];

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
    DatePickerModule,
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
  private readonly configService = inject(EcommerceConfigService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  // ── Tabs ──────────────────────────────────────────────────────────────
  public readonly tabs: { id: TabId; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: 'store' },
    { id: 'location', label: 'Ubicación y Horario', icon: 'map-pin' },
    { id: 'payments', label: 'Pagos', icon: 'credit-card' },
    { id: 'social', label: 'Redes Sociales', icon: 'share2' },
    { id: 'notifications', label: 'Notificaciones', icon: 'mail' },
  ];
  public readonly activeTab = signal<TabId>('general');

  setActiveTab(tab: TabId): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    // Reset scroll to the top of the form column whenever the tab changes
    queueMicrotask(() => {
      this.mainColumn()?.nativeElement?.scrollTo?.({ top: 0, behavior: 'auto' });
    });
  }

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
  public readonly draftShowCategoriesSection = signal(true);
  public readonly draftSocialLinks = signal<SocialLinks>({ ...DEFAULT_SOCIAL_LINKS });
  public readonly draftTemplate = signal<CatalogTemplate>('banner-centered');
  public readonly draftCurrencySymbol = signal('$');
  public readonly draftShowReferencePrice = signal(true);
  public readonly draftShowLocalCurrencyPrice = signal(true);
  public readonly draftWhatsappOrderMessage = signal<string | null>(null);
  public readonly draftNotifyNewOrders = signal<boolean>(true);

  // WhatsApp notifications (tabla whatsapp_notification_settings). Se cargan
  // y guardan aparte del config del catálogo (otra tabla). El número
  // destinatario de `order_received` sale de los whatsappButtons del catálogo.
  // "Nueva orden recibida" arranca ACTIVA por defecto (UI nudge). El número
  // destinatario es standalone (no es un botón de vendedor del checkout).
  public readonly draftNotifyOrderReceived = signal<boolean>(true);
  public readonly draftNotifyOrderCompleted = signal<boolean>(false);
  public readonly draftWhatsappNotifyNumber = signal<string | null>(null);
  /** Progressive disclosure: mostrar el input de número recién al hacer click
   *  en "Agregar número". */
  public readonly showRecipientNumberInput = signal<boolean>(false);
  public readonly isTestingWhatsapp = signal<boolean>(false);
  private readonly lastSyncedWhatsappNotify = signal<{
    orderReceived: boolean;
    orderCompleted: boolean;
    recipientNumber: string | null;
  }>({ orderReceived: true, orderCompleted: false, recipientNumber: null });

  // Business hours editor (one row per day, Sunday → Saturday)
  public readonly dayLabels = DAY_LABELS_ES;
  public readonly draftBusinessHours = signal<BusinessHoursWeek>(
    DEFAULT_BUSINESS_HOURS_WEEK.map((d) => ({ ...d }))
  );
  /** Snapshot used to detect changes — set whenever we sync from the server.
   *  Must be a signal so `hasUnsavedHours` re-evaluates after a save updates
   *  it; a plain field would leave the unsaved banner sticky after persisting
   *  hours-only edits. */
  private readonly lastSyncedHours = signal<BusinessHoursWeek>(
    DEFAULT_BUSINESS_HOURS_WEEK.map((d) => ({ ...d }))
  );

  public readonly hasUnsavedHours = computed(() => {
    const a = JSON.stringify(this.draftBusinessHours());
    const b = JSON.stringify(this.lastSyncedHours());
    return a !== b;
  });

  /** Return the draft hours sorted Mon→Sun (Sunday last) for display, with
   *  precomputed `Date` instances for the time-only datepicker. Using a
   *  computed (instead of a method called from the template) keeps the Date
   *  references stable between signal updates — otherwise every CD cycle
   *  produces new Date objects and `[ngModel]` thinks the value changed,
   *  causing p-datepicker to write back, looping forever. */
  public readonly orderedDraftHours = computed(() => {
    const week = this.draftBusinessHours();
    return this.dayLabels
      .map((l) => {
        const day = week.find((d) => d.dayOfWeek === l.day);
        if (!day) return null;
        return {
          ...day,
          label: l.label,
          openDate: this.timeStringToDate(day.openTime),
          closeDate: this.timeStringToDate(day.closeTime),
        };
      })
      .filter((d): d is NonNullable<typeof d> => !!d);
  });

  updateDayIsOpen(dayOfWeek: number, isOpen: boolean): void {
    this.draftBusinessHours.update((week) =>
      week.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, isOpen } : d))
    );
  }

  updateDayOpenTime(dayOfWeek: number, openTime: string): void {
    this.draftBusinessHours.update((week) =>
      week.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, openTime } : d))
    );
  }

  updateDayCloseTime(dayOfWeek: number, closeTime: string): void {
    this.draftBusinessHours.update((week) =>
      week.map((d) => (d.dayOfWeek === dayOfWeek ? { ...d, closeTime } : d))
    );
  }

  /** PrimeNG's `p-datepicker [timeOnly]` works with Date objects. We store
   *  business hours as "HH:MM" strings, so convert at the binding edges. */
  timeStringToDate(time: string | null | undefined): Date | null {
    if (!time) return null;
    const [hStr, mStr] = time.split(':');
    const h = Number(hStr);
    const m = Number(mStr ?? '0');
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  private dateToTimeString(d: Date | null | undefined): string | null {
    if (!d) return null;
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  setDayOpenDate(dayOfWeek: number, date: Date | null): void {
    const time = this.dateToTimeString(date);
    if (!time) return;
    // Guard: skip redundant updates so p-datepicker round-tripping its own
    // value can't push us into an infinite signal-update loop.
    const current = this.draftBusinessHours().find((d) => d.dayOfWeek === dayOfWeek);
    if (current?.openTime?.startsWith(time)) return;
    this.updateDayOpenTime(dayOfWeek, time);
  }

  setDayCloseDate(dayOfWeek: number, date: Date | null): void {
    const time = this.dateToTimeString(date);
    if (!time) return;
    const current = this.draftBusinessHours().find((d) => d.dayOfWeek === dayOfWeek);
    if (current?.closeTime?.startsWith(time)) return;
    this.updateDayCloseTime(dayOfWeek, time);
  }

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

    // Business hours (lives on tenant_business_hours, one row per day)
    if (this.hasUnsavedHours()) return true;

    // WhatsApp notification settings (lives on whatsapp_notification_settings)
    const wn = this.lastSyncedWhatsappNotify();
    if (
      this.draftNotifyOrderReceived() !== wn.orderReceived ||
      this.draftNotifyOrderCompleted() !== wn.orderCompleted ||
      (this.draftWhatsappNotifyNumber() ?? null) !== (wn.recipientNumber ?? null)
    ) {
      return true;
    }

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
      syncField(this.draftShowCategoriesSection, prev?.showCategoriesSection ?? true, config.showCategoriesSection ?? true);
      syncField(this.draftTemplate, prev?.template ?? 'banner-centered' as CatalogTemplate, config.template ?? 'banner-centered' as CatalogTemplate);
      syncField(this.draftCurrencySymbol, prev?.currencySymbol ?? '$', config.currencySymbol ?? '$');
      syncField(this.draftShowReferencePrice, prev?.showReferencePrice ?? true, config.showReferencePrice ?? true);
      syncField(this.draftShowLocalCurrencyPrice, prev?.showLocalCurrencyPrice ?? true, config.showLocalCurrencyPrice ?? true);
      syncField(this.draftWhatsappOrderMessage, prev?.whatsappOrderMessage ?? null, config.whatsappOrderMessage ?? null);
      syncField(this.draftNotifyNewOrders, prev?.notifyNewOrders ?? true, config.notifyNewOrders ?? true);
      syncFieldJson(this.draftWhatsappButtons, prevButtons, newButtons);
      syncFieldJson(this.draftSocialLinks, prev?.socialLinks ?? DEFAULT_SOCIAL_LINKS, config.socialLinks ?? { ...DEFAULT_SOCIAL_LINKS });

      this.lastSyncedConfig = { ...config };
    });

    // Send preview messages when drafts change
    effect(() => {
      // Guard: don't broadcast until the config has loaded. Otherwise the
      // first firings spread `logo: null`/`banner: null` into the iframe's
      // override map and clobber the values the iframe loaded itself from
      // the public RPC.
      const config = this.configStore.config();
      if (!config) return;

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
      const showCategoriesSection = this.draftShowCategoriesSection();

      const message = {
        type: 'PREVIEW_UPDATE' as const,
        payload: {
          name,
          logo: config.logo,
          banner: config.banner,
          themeColor,
          showDesignSection,
          showCategoriesSection,
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

    // Restore active tab from query param (?tab=general|location|payments|social).
    // We treat the query param as one-way bootstrap — afterwards the signal is
    // the source of truth and setActiveTab keeps the URL in sync.
    const initialTab = this.route.snapshot.queryParamMap.get('tab') as TabId | null;
    if (initialTab && VALID_TABS.includes(initialTab)) {
      this.activeTab.set(initialTab);
    }

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (tenantId) {
      this.configStore.reloadConfig(String(tenantId));
      this.configStore.loadPaymentMethods(String(tenantId));
      this.configStore.loadCurrencyConfig(String(tenantId));
      this.loadBusinessHours(String(tenantId));
      this.loadWhatsappNotifySettings(String(tenantId));
    }
  }

  private async loadWhatsappNotifySettings(tenantId: string): Promise<void> {
    const result = await this.configService.getWhatsappNotifySettings(tenantId);
    result.mapRight((s) => {
      this.draftNotifyOrderReceived.set(s.orderReceived);
      this.draftNotifyOrderCompleted.set(s.orderCompleted);
      this.draftWhatsappNotifyNumber.set(s.recipientNumber);
      this.lastSyncedWhatsappNotify.set({ ...s });
    });
  }

  /** Envía un WhatsApp de prueba al número que se está configurando (sin
   *  necesidad de guardar primero). */
  public async testWhatsappNotification(): Promise<void> {
    const number = this.draftWhatsappNotifyNumber();
    if (!number) return;
    this.isTestingWhatsapp.set(true);
    const result = await this.configService.sendTestWhatsapp(
      number,
      this.draftName(),
      this.configStore.config()?.tenantId ?? ''
    );
    result.fold(
      (err) =>
        toast.error('No se pudo enviar la prueba: ' + (err.message || '')),
      () => toast.success('¡Te enviamos un WhatsApp de prueba a ese número!')
    );
    this.isTestingWhatsapp.set(false);
  }

  private async loadBusinessHours(tenantId: string): Promise<void> {
    const result = await this.configService.getBusinessHours(tenantId);
    result.fold(
      () => {
        // Service errored — keep the current draft (defaults) so the form
        // still renders. The save flow will surface the error later.
      },
      (week) => {
        const cloned = week.map((d) => ({ ...d }));
        this.draftBusinessHours.set(cloned);
        this.lastSyncedHours.set(cloned.map((d) => ({ ...d })));
      }
    );
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
    if (this.draftShowCategoriesSection() !== (config.showCategoriesSection ?? true)) changes.showCategoriesSection = this.draftShowCategoriesSection();
    if (this.draftCurrencySymbol() !== (config.currencySymbol ?? '$')) changes.currencySymbol = this.draftCurrencySymbol();
    if (this.draftShowReferencePrice() !== (config.showReferencePrice ?? true)) changes.showReferencePrice = this.draftShowReferencePrice();
    if (this.draftShowLocalCurrencyPrice() !== (config.showLocalCurrencyPrice ?? true)) changes.showLocalCurrencyPrice = this.draftShowLocalCurrencyPrice();
    if (this.draftWhatsappOrderMessage() !== (config.whatsappOrderMessage ?? null)) changes.whatsappOrderMessage = this.draftWhatsappOrderMessage();
    if (this.draftNotifyNewOrders() !== (config.notifyNewOrders ?? true)) changes.notifyNewOrders = this.draftNotifyNewOrders();

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

    // Track silent ops (country, currency, hours) so we can fall back to a
    // unified toast when `updatePartialConfig` doesn't run — its success
    // toast is the only one the other paths rely on, so without this the
    // user sees no feedback when they only change hours/currency/country.
    let didSilentOp = false;
    let hadSilentError = false;

    // 1. Country lives on tenants → separate call.
    // Persist the Spanish label as `tenants.country` so it renders directly
    // in the public catalog without needing client-side translation.
    const newCountryCode = this.draftCountryCode();
    if (config && newCountryCode && newCountryCode !== (config.countryCode ?? null)) {
      const country = findCountryByCode(newCountryCode);
      if (country) {
        didSilentOp = true;
        const beforeError = this.configStore.error();
        await this.configStore.saveTenantCountry(country.label, country.code);
        if (this.configStore.error() && this.configStore.error() !== beforeError) {
          hadSilentError = true;
        }
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
      didSilentOp = true;
      const beforeError = this.configStore.error();
      await this.configStore.saveCurrencyConfig(currencyPatch);
      if (this.configStore.error() && this.configStore.error() !== beforeError) {
        hadSilentError = true;
      }
    }

    // 3. Everything else goes through updateConfig (this one DOES toast on its own)
    if (Object.keys(changes).length > 0) {
      await this.configStore.updatePartialConfig(changes);
    }

    // 3b. Business hours live on tenant_business_hours (one row per day)
    if (this.hasUnsavedHours() && config?.tenantId) {
      didSilentOp = true;
      const week = this.draftBusinessHours();
      const result = await this.configService.upsertBusinessHours(
        config.tenantId,
        week
      );
      result.fold(
        () => {
          hadSilentError = true;
          toast.error('Error al guardar el horario');
        },
        () => {
          this.lastSyncedHours.set(week.map((d) => ({ ...d })));
        }
      );
    }

    // 3c. WhatsApp notification settings live on whatsapp_notification_settings
    //     → separate call. Only save when the drafts actually changed.
    const wn = this.lastSyncedWhatsappNotify();
    const whatsappNotifyChanged =
      this.draftNotifyOrderReceived() !== wn.orderReceived ||
      this.draftNotifyOrderCompleted() !== wn.orderCompleted ||
      (this.draftWhatsappNotifyNumber() ?? null) !== (wn.recipientNumber ?? null);
    if (whatsappNotifyChanged && config?.tenantId) {
      didSilentOp = true;
      const next = {
        orderReceived: this.draftNotifyOrderReceived(),
        orderCompleted: this.draftNotifyOrderCompleted(),
        recipientNumber: this.draftWhatsappNotifyNumber(),
      };
      const result = await this.configService.saveWhatsappNotifySettings(
        config.tenantId,
        next
      );
      result.fold(
        () => {
          hadSilentError = true;
          toast.error('Error al guardar las notificaciones de WhatsApp');
        },
        () => this.lastSyncedWhatsappNotify.set(next)
      );
    }

    // Surface a single success toast when only silent ops ran. When
    // `updatePartialConfig` ran we let its own toast speak, since duplicating
    // it would be noisy.
    if (didSilentOp && !hadSilentError && Object.keys(changes).length === 0) {
      toast.success('Catálogo actualizado correctamente');
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
