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
import { TranslocoPipe } from '@jsverse/transloco';
import { ActivatedRoute, Router } from '@angular/router';
import { DatePickerModule } from 'primeng/datepicker';
import { isDevMode } from '@catalogohoy/core';
import { environment } from '@catalogohoy/env';
import { PlanStore } from '@catalogohoy/plan';
import { TenantStore, getTenantSlugFromUrl, isCustomDomain } from '@catalogohoy/tenant';
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
import { HtmlSanitizerService } from '@shared/infrastructure';
import { EditorModule } from 'primeng/editor';
import { translate } from '@jsverse/transloco';
import { toast as sonnerToast } from 'ngx-sonner';

// key-as-text: los mensajes son keys de transloco y ngx-sonner no traduce
// solo, así que este alias traduce antes de mostrar (mismo rol que ToastService).
const toast = {
  success: (msg: string) => sonnerToast.success(translate(msg)),
  error: (msg: string) => sonnerToast.error(translate(msg)),
  loading: (msg: string) => sonnerToast.loading(translate(msg)),
  dismiss: (id?: string | number) => sonnerToast.dismiss(id),
};
import { Observable } from 'rxjs';
import {
  BusinessHoursWeek,
  CatalogTemplate,
  createDefaultShippingMethod,
  createDefaultShippingMethods,
  CustomerFieldsConfig,
  DAY_LABELS_ES,
  DEFAULT_BUSINESS_HOURS_WEEK,
  DEFAULT_CURRENCY_CONFIG,
  DEFAULT_CUSTOMER_FIELDS,
  DEFAULT_SOCIAL_LINKS,
  DEFAULT_WHATSAPP_ORDER_MESSAGE,
  EcommerceConfig,
  ExchangeRateType,
  PreviewMessage,
  findCountryByCode,
  ShippingMethod,
  SHIPPING_METHOD_TYPE_OPTIONS,
  SocialLinks,
  SUPPORTED_COUNTRIES,
  SUPPORTED_CURRENCIES,
  TenantCurrencyConfig,
  THEME_COLORS,
  WHATSAPP_MESSAGE_MAX_LENGTH,
  WHATSAPP_MESSAGE_VARIABLES,
  WhatsappButton,
  PaymentFieldDef,
  PaymentMethodEntity,
  paymentMethodFields,
} from '../../domain';
import {
  EcommerceConfigService,
  EcommerceConfigStore,
  LocationApiService,
  TenantCurrencyStore,
} from '../../infrastructure';
import { PhoneMockupComponent } from '../components/phone-mockup/phone-mockup';
import { TemplateSelectorComponent } from '../components/template-selector/template-selector';

export type TabId = 'general' | 'location' | 'shipping' | 'payments' | 'social' | 'notifications';
const VALID_TABS: TabId[] = ['general', 'location', 'shipping', 'payments', 'social', 'notifications'];

/** Máximo de cambios de slug por ventana rodante de 30 días (lo aplica la
 *  RPC change_tenant_slug; acá solo se usa para la UI). */
const SLUG_CHANGES_PER_MONTH = 2;

/** Códigos de error de la RPC change_tenant_slug → mensaje para el usuario. */
const SLUG_ERROR_MESSAGES: Record<string, string> = {
  limit_reached: 'Ya usaste los 2 cambios de dirección de este mes. Vas a poder cambiarla de nuevo más adelante.',
  slug_taken: 'Esa dirección ya está en uso por otro catálogo.',
  invalid_slug: 'La dirección solo puede tener minúsculas, números y guiones (3 a 40 caracteres).',
  reserved_slug: 'Esa dirección está reservada por la plataforma.',
  same_slug: 'Esa ya es la dirección actual de tu catálogo.',
  not_authorized: 'Solo el dueño del catálogo puede cambiar la dirección.',
};

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
    EditorModule,
    ColorPickerComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
    TextareaComponent,
    PhoneMockupComponent,
    TemplateSelectorComponent,
    DatePickerModule,
    TranslocoPipe,
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
  private readonly htmlSanitizer = inject(HtmlSanitizerService);
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
  public readonly tabs: { id: TabId; label: string; icon: string; badge?: string }[] = [
    { id: 'general', label: 'General', icon: 'store' },
    { id: 'location', label: 'Ubicación y Horario', icon: 'map-pin' },
    { id: 'payments', label: 'Pagos', icon: 'credit-card' },
    { id: 'shipping', label: 'Envío', icon: 'truck', badge: 'Nuevo' },
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

  /** Recalcula si la barra de tabs puede scrollear a izquierda/derecha (para
   *  mostrar u ocultar las flechas). Se llama al montar, al scrollear y al
   *  cambiar el ancho. */
  updateTabScroll(): void {
    const el = this.tabsNav()?.nativeElement;
    if (!el) return;
    this.canScrollTabsLeft.set(el.scrollLeft > 2);
    this.canScrollTabsRight.set(
      Math.ceil(el.scrollLeft + el.clientWidth) < el.scrollWidth - 2
    );
  }

  /** Desplaza la barra de tabs (−1 izquierda, +1 derecha). */
  scrollTabs(direction: number): void {
    const el = this.tabsNav()?.nativeElement;
    if (!el) return;
    el.scrollBy({
      left: direction * Math.max(140, el.clientWidth * 0.6),
      behavior: 'smooth',
    });
  }

  /** Re-push the latest preview state after the iframe (re)loads — switching to
   *  the Envío tab swaps the frame to the public checkout, which boots fresh and
   *  must immediately reflect the current draft (shipping methods, fields…). */
  onPreviewIframeLoaded(): void {
    const msg = this.lastPreviewMessage;
    if (!msg) return;
    // The fresh frame wires its message listener on init; a tick avoids racing it.
    setTimeout(() => {
      this.phoneMockup()?.sendPreviewMessage(msg);
      this.phoneMockupOverlay()?.sendPreviewMessage(msg);
    }, 250);
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
  public readonly draftNotifyWeeklyReport = signal<boolean>(true);

  // --- Shipping (Envío) tab drafts ---
  public readonly draftShippingMethods = signal<ShippingMethod[]>([]);
  public readonly draftShowShippingSection = signal<boolean>(false);
  public readonly draftCustomerFields = signal<CustomerFieldsConfig>({
    name: { ...DEFAULT_CUSTOMER_FIELDS.name },
    phone: { ...DEFAULT_CUSTOMER_FIELDS.phone },
    email: { ...DEFAULT_CUSTOMER_FIELDS.email },
  });
  public readonly shippingTypeOptions = SHIPPING_METHOD_TYPE_OPTIONS;

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

  // --- Slug del catálogo (tenants.slug — define la URL pública y del admin) ---
  /** Slug actual confirmado en el servidor. Vacío hasta que carga el tenant. */
  public readonly currentSlug = signal('');
  public readonly draftSlug = signal('');
  /** Cambios de slug usados en los últimos 30 días. Null = aún no cargó. */
  public readonly slugChangesUsed = signal<number | null>(null);
  /** Límite del tenant (tenants.slug_change_limit, default 2). */
  public readonly slugChangeLimit = signal(SLUG_CHANGES_PER_MONTH);
  public readonly slugChangesRemaining = computed(() =>
    Math.max(0, this.slugChangeLimit() - (this.slugChangesUsed() ?? 0))
  );
  public readonly isSlugDirty = computed(
    () => this.currentSlug() !== '' && this.draftSlug() !== this.currentSlug()
  );
  public readonly slugFormatError = computed(() => {
    if (!this.isSlugDirty()) return false;
    const slug = this.draftSlug();
    return (
      !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) ||
      slug.length < 3 ||
      slug.length > 40
    );
  });
  public readonly isOwner = computed(() => this.permissions.isOwner());

  /** Normaliza mientras escribe: minúsculas y espacios → guiones. */
  public onSlugInput(value: string): void {
    this.draftSlug.set(value.toLowerCase().replace(/\s+/g, '-'));
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

  // iframe URL — points the preview at the public checkout while the user is on
  // the "Envío" or "Pagos" tabs (so they see how shipping/customer fields and
  // payment methods look at checkout), and at the catalog home otherwise. Only
  // the path crossing the checkout boundary changes the URL, so unrelated tab
  // switches don't reload it.
  private readonly previewSlug = signal<string>('');
  private readonly CHECKOUT_TABS: TabId[] = ['shipping', 'payments'];
  private readonly previewPath = computed(() =>
    this.CHECKOUT_TABS.includes(this.activeTab()) ? '/checkout' : '/'
  );
  public readonly safeIframeUrl = computed<SafeResourceUrl | ''>(() => {
    const slug = this.previewSlug();
    if (!slug) return '';
    const url = `${window.location.origin}${this.previewPath()}?slug=${slug}&preview=true`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });

  /** Last preview message sent — re-sent when the iframe (re)loads so a fresh
   *  checkout/catalog frame immediately reflects the current draft. */
  private lastPreviewMessage: PreviewMessage | null = null;

  // Tracks the last config snapshot used to sync drafts
  private lastSyncedConfig: EcommerceConfig | null = null;

  // Save button visibility tracking
  private readonly topSaveAnchor = viewChild<ElementRef>('topSaveAnchor');
  private readonly bottomSaveAnchor = viewChild<ElementRef>('bottomSaveAnchor');
  private readonly mainColumn = viewChild<ElementRef>('mainColumn');
  // Scroll horizontal de los tabs: flechas cuando la barra desborda (mobile).
  private readonly tabsNav = viewChild<ElementRef<HTMLElement>>('tabsNav');
  public readonly canScrollTabsLeft = signal(false);
  public readonly canScrollTabsRight = signal(false);
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

    // Flechas de scroll de los tabs: recalcular al montar y cuando cambia el
    // ancho de la barra (ResizeObserver). El scroll manual dispara (scroll).
    effect((onCleanup) => {
      const nav = this.tabsNav()?.nativeElement;
      if (!nav) return;
      this.updateTabScroll();
      const ro = new ResizeObserver(() => this.updateTabScroll());
      ro.observe(nav);
      onCleanup(() => ro.disconnect());
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
      syncField(this.draftNotifyWeeklyReport, prev?.notifyWeeklyReport ?? true, config.notifyWeeklyReport ?? true);
      syncFieldJson(this.draftWhatsappButtons, prevButtons, newButtons);
      syncFieldJson(this.draftSocialLinks, prev?.socialLinks ?? DEFAULT_SOCIAL_LINKS, config.socialLinks ?? { ...DEFAULT_SOCIAL_LINKS });
      syncField(this.draftShowShippingSection, prev?.showShippingSection ?? false, config.showShippingSection ?? false);
      // Seed two starter methods (pickup + national shipping) when none are
      // configured, so the list is never empty. Stable seed ids keep the JSON
      // comparison consistent; the merchant just hits Guardar to persist them.
      const prevMethods = prev?.shippingMethods?.length ? prev.shippingMethods : createDefaultShippingMethods();
      const newMethods = config.shippingMethods?.length ? config.shippingMethods : createDefaultShippingMethods();
      syncFieldJson(this.draftShippingMethods, prevMethods, newMethods);
      syncFieldJson(this.draftCustomerFields, prev?.customerFields ?? DEFAULT_CUSTOMER_FIELDS, config.customerFields ?? DEFAULT_CUSTOMER_FIELDS);

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
      // Rich HTML — sent live so the preview reflects formatting as you type.
      const description = this.draftDescription();
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
      // Shipping drafts — so the checkout preview reflects them live.
      const shippingMethods = this.draftShippingMethods();
      const showShippingSection = this.draftShowShippingSection();
      const customerFields = this.draftCustomerFields();
      // Métodos de pago activos (con sus datos) — para que la preview del
      // checkout refleje en vivo los datos al elegir un método, sin recargar.
      const paymentMethods = this.configStore
        .paymentMethodsList()
        .filter((m) => m.isActive);

      const message = {
        type: 'PREVIEW_UPDATE' as const,
        payload: {
          name,
          description,
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
          shippingMethods,
          showShippingSection,
          customerFields,
          // Solo overrideamos si hay métodos activos cargados; si la lista aún
          // no cargó (vacía), la preview usa los del catálogo real.
          ...(paymentMethods.length ? { paymentMethods } : {}),
        },
        source: 'catalogohoy-admin' as const,
      };

      this.lastPreviewMessage = message;
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
      this.previewSlug.set(slug);
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
      this.loadSlugChanges(String(tenantId));

      // El slug del store es el confirmado en DB (en dev el de la URL
      // puede ser el path del admin, no el slug real).
      const tenantSlug = this.tenantStore.tenantSlug();
      if (tenantSlug) {
        this.currentSlug.set(tenantSlug);
        this.draftSlug.set(tenantSlug);
      }
    }
  }

  private async loadSlugChanges(tenantId: string): Promise<void> {
    const result = await this.configService.getSlugChangeStatus(tenantId);
    result.mapRight(({ used, limit }) => {
      this.slugChangesUsed.set(used);
      this.slugChangeLimit.set(limit);
    });
  }

  /** Tras cambiar el slug, el subdominio actual del admin deja de existir:
   *  redirigimos al nuevo pasando el token de sesión por query param — el
   *  mismo hand-off que usa el login (AppComponent lo persiste a localStorage
   *  en el bootstrap del origen nuevo, así no se pierde la sesión). */
  private redirectToNewSlug(newSlug: string): void {
    if (isDevMode() || isCustomDomain()) {
      // En dev el host no depende del slug; con dominio propio el admin
      // vive en el custom domain. En ambos casos basta recargar.
      window.location.reload();
      return;
    }
    const projectRef = new URL(environment.supabaseUrl).hostname.split('.')[0];
    const tokenKey = `sb-${projectRef}-auth-token`;
    const token = localStorage.getItem(tokenKey);
    const session = token ? `?${tokenKey}=${encodeURIComponent(token)}` : '';
    window.location.href = `https://${newSlug}.catalogohoy.com/admin/catalog/edit${session}`;
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
    if (this.draftDescription() !== (config.description ?? '')) changes.description = this.htmlSanitizer.sanitizeRichText(this.draftDescription());
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
    if (this.draftNotifyWeeklyReport() !== (config.notifyWeeklyReport ?? true)) changes.notifyWeeklyReport = this.draftNotifyWeeklyReport();

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

    if (this.draftShowShippingSection() !== (config.showShippingSection ?? false)) {
      changes.showShippingSection = this.draftShowShippingSection();
    }
    if (JSON.stringify(this.draftShippingMethods()) !== JSON.stringify(config.shippingMethods ?? [])) {
      changes.shippingMethods = this.draftShippingMethods();
    }
    const serverCustomerFields = config.customerFields ?? DEFAULT_CUSTOMER_FIELDS;
    if (JSON.stringify(this.draftCustomerFields()) !== JSON.stringify(serverCustomerFields)) {
      changes.customerFields = this.draftCustomerFields();
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
        displayCode: cc.displayCurrency,
        showDualCurrency: cc.showDualCurrency,
        countryCode: finalCode,
      });
    }

  }

  // --- Cambio de slug: flujo propio, fuera de "Guardar cambios" ---
  // La dirección redirige el admin al subdominio nuevo al aplicarse, así
  // que tiene su botón y confirmación aparte en vez del guardado unificado.

  public readonly isChangingSlug = signal(false);

  public readonly canSubmitSlug = computed(
    () =>
      this.isSlugDirty() &&
      !this.slugFormatError() &&
      this.isOwner() &&
      this.slugChangesRemaining() > 0 &&
      !this.isChangingSlug()
  );

  public confirmSlugChange(): void {
    if (!this.canSubmitSlug()) return;
    const remaining = this.slugChangesRemaining();
    this.confirmDialogService
      .info({
        headerLabel: 'Cambiar la dirección del catálogo',
        contentLabel:
          `Tu catálogo pasará a ${this.draftSlug()}.catalogohoy.com. ` +
          'Los enlaces y códigos QR con la dirección anterior dejarán de funcionar. ' +
          (remaining === 1
            ? 'Este es tu último cambio disponible del mes.'
            : `Te quedan ${remaining} cambios este mes.`),
        acceptLabel: 'Cambiar dirección',
        rejectLabel: 'Cancelar',
        closable: true,
        dismissableMask: true,
      })
      .subscribe((result) => {
        result.fold(
          () => undefined,
          () => this.changeSlug()
        );
      });
  }

  private async changeSlug(): Promise<void> {
    const tenantId = this.configStore.config()?.tenantId;
    if (!tenantId) return;

    this.isChangingSlug.set(true);
    const result = await this.configService.changeTenantSlug(
      tenantId,
      this.draftSlug()
    );
    result.fold(
      (err) => {
        this.isChangingSlug.set(false);
        toast.error(
          SLUG_ERROR_MESSAGES[err.message] ??
            'No se pudo cambiar la dirección del catálogo.'
        );
        // Refresca el contador por si el error fue limit_reached.
        this.loadSlugChanges(tenantId);
      },
      ({ slug }) => {
        // isChangingSlug queda en true a propósito: el spinner del botón
        // cubre la espera hasta el redirect.
        toast.success('Dirección actualizada. Te llevamos a tu nueva URL…');
        setTimeout(() => this.redirectToNewSlug(slug), 1200);
      }
    );
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

  // --- Datos del método (banco, cuenta, etc.) ---
  /** Id del método cuyo form de datos está abierto (null = ninguno). */
  public readonly expandedMethodId = signal<number | null>(null);
  /** Borrador de los datos que se están editando. */
  public readonly detailsDraft = signal<Record<string, string>>({});

  /** Campos configurables de un método según su nombre (tipo inferido). Para
   *  transferencia, el país (Venezuela o no) cambia el set de campos. */
  public fieldsFor(name: string): PaymentFieldDef[] {
    return paymentMethodFields(name, this.isVenezuela());
  }

  /** Abre/cierra el form de datos de un método (precarga el borrador). */
  public toggleMethodDetails(method: PaymentMethodEntity): void {
    if (this.expandedMethodId() === method.id) {
      this.expandedMethodId.set(null);
      return;
    }
    this.detailsDraft.set({ ...(method.details ?? {}) });
    this.expandedMethodId.set(method.id);
  }

  public setDetailField(key: string, value: string): void {
    this.detailsDraft.update((d) => ({ ...d, [key]: value }));
  }

  public saveMethodDetails(method: PaymentMethodEntity): void {
    this.configStore.savePaymentMethodDetails(method.id, this.detailsDraft());
    this.expandedMethodId.set(null);
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

  // --- Shipping (Envío) Section ---
  addShippingMethod() {
    const current = this.draftShippingMethods();
    const method = createDefaultShippingMethod(current.length);
    // First method added becomes the default.
    if (current.length === 0) method.isDefault = true;
    this.draftShippingMethods.set([...current, method]);
  }

  removeShippingMethod(id: string) {
    const current = this.draftShippingMethods();
    const wasDefault = current.find((m) => m.id === id)?.isDefault;
    let next = current
      .filter((m) => m.id !== id)
      .map((m, i) => ({ ...m, position: i }));
    // If we removed the default, promote the first remaining active method.
    if (wasDefault && next.length && !next.some((m) => m.isDefault)) {
      next = next.map((m, i) => ({ ...m, isDefault: i === 0 }));
    }
    this.draftShippingMethods.set(next);
  }

  updateShippingMethodField<K extends keyof ShippingMethod>(
    id: string,
    key: K,
    value: ShippingMethod[K]
  ) {
    this.draftShippingMethods.set(
      this.draftShippingMethods().map((m) =>
        m.id === id ? { ...m, [key]: value } : m
      )
    );
  }

  /** Coerce the raw number-input string into a finite number (or 0/null). */
  updateShippingMethodNumber(
    id: string,
    key: 'fee' | 'lat' | 'lng',
    raw: string | number | null
  ) {
    const n = raw === '' || raw === null ? null : Number(raw);
    const value = n != null && Number.isFinite(n) ? n : key === 'fee' ? 0 : null;
    this.updateShippingMethodField(id, key, value as ShippingMethod[typeof key]);
  }

  setDefaultShippingMethod(id: string) {
    this.draftShippingMethods.set(
      this.draftShippingMethods().map((m) => ({ ...m, isDefault: m.id === id }))
    );
  }

  moveShippingMethod(id: string, dir: -1 | 1) {
    const current = [...this.draftShippingMethods()];
    const i = current.findIndex((m) => m.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= current.length) return;
    [current[i], current[j]] = [current[j], current[i]];
    this.draftShippingMethods.set(current.map((m, idx) => ({ ...m, position: idx })));
  }

  // --- Customer fields config ---
  updateCustomerField(
    field: keyof CustomerFieldsConfig,
    key: 'visible' | 'required',
    value: boolean
  ) {
    const current = this.draftCustomerFields();
    const next = { ...current, [field]: { ...current[field], [key]: value } };
    // A field that's hidden can't be required.
    if (key === 'visible' && !value) next[field].required = false;
    this.draftCustomerFields.set(next);
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
