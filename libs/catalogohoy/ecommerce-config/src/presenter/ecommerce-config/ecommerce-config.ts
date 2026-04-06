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
import { TenantStore, getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import {
  ButtonComponent,
  CardComponent,
  ColorPickerComponent,
  ConfirmDialogService,
  IconComponent,
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
  DEFAULT_SOCIAL_LINKS,
  EcommerceConfig,
  SocialLinks,
  THEME_COLORS,
  VENEZUELAN_STATES,
  WhatsappButton,
} from '../../domain';
import { EcommerceConfigStore } from '../../infrastructure';
import { PhoneMockupComponent } from '../components/phone-mockup/phone-mockup';
import { TemplateSelectorComponent } from '../components/template-selector/template-selector';

@Component({
  selector: 'lib-ecommerce-config',
  imports: [
    FormsModule,
    ButtonComponent,
    InputTextComponent,
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
  private readonly sanitizer = inject(DomSanitizer);
  private readonly confirmDialogService = inject(ConfirmDialogService);
  private readonly permissions = inject(TeamPermissionsStore);
  protected readonly canEditCatalog = computed(() => this.permissions.isOwner() || this.permissions.can()('catalogo', 'edit'));

  public readonly themeColors = THEME_COLORS;
  public readonly venezuelanStates = VENEZUELAN_STATES;

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

  // Draft signals
  public readonly draftName = signal('');
  public readonly draftDescription = signal('');
  public readonly draftWhatsappButtons = signal<WhatsappButton[]>([]);
  public readonly draftThemeColor = signal('#10b981');
  public readonly draftState = signal<string | null>(null);
  public readonly draftCity = signal<string | null>(null);
  public readonly draftShowDesignSection = signal(true);
  public readonly draftShowLocationSection = signal(true);
  public readonly draftShowPaymentMethodsSection = signal(true);
  public readonly draftSocialLinks = signal<SocialLinks>({ ...DEFAULT_SOCIAL_LINKS });
  public readonly draftTemplate = signal<CatalogTemplate>('classic');
  public readonly draftCurrencySymbol = signal('$');

  // Computed
  public readonly isCustomColor = computed(
    () => !this.themeColors.some((c) => c.value === this.draftThemeColor())
  );
  public readonly hasUnsavedChanges = computed(() => {
    const config = this.configStore.config();
    if (!config) return false;
    return Object.keys(this.getChangedFields()).length > 0;
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
      syncField(this.draftState, prev?.state ?? null, config.state ?? null);
      syncField(this.draftCity, prev?.city ?? null, config.city ?? null);
      syncField(this.draftShowDesignSection, prev?.showDesignSection ?? true, config.showDesignSection ?? true);
      syncField(this.draftShowLocationSection, prev?.showLocationSection ?? true, config.showLocationSection ?? true);
      syncField(this.draftShowPaymentMethodsSection, prev?.showPaymentMethodsSection ?? true, config.showPaymentMethodsSection ?? true);
      syncField(this.draftTemplate, prev?.template ?? 'classic' as CatalogTemplate, config.template ?? 'classic' as CatalogTemplate);
      syncField(this.draftCurrencySymbol, prev?.currencySymbol ?? '$', config.currencySymbol ?? '$');
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
      const logo = this.configStore.config()?.logo ?? null;
      const banner = this.configStore.config()?.banner ?? null;

      const message = {
        type: 'PREVIEW_UPDATE' as const,
        payload: { name, logo, banner, themeColor, showDesignSection, socialLinks, template, currencySymbol },
        source: 'catalogohoy-admin' as const,
      };

      this.phoneMockup()?.sendPreviewMessage(message);
      this.phoneMockupOverlay()?.sendPreviewMessage(message);
    });
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
    }
  }

  // --- Unified Save ---
  getChangedFields(): Partial<EcommerceConfig> {
    const config = this.configStore.config();
    if (!config) return {};

    const changes: Partial<EcommerceConfig> = {};

    if (this.draftName() !== (config.name ?? '')) changes.name = this.draftName();
    if (this.draftDescription() !== (config.description ?? '')) changes.description = this.draftDescription();
    if (this.draftTemplate() !== (config.template ?? 'classic')) changes.template = this.draftTemplate();
    if (this.draftThemeColor() !== (config.themeColor ?? '#10b981')) changes.themeColor = this.draftThemeColor();
    if (this.draftState() !== (config.state ?? null)) changes.state = this.draftState();
    if (this.draftCity() !== (config.city ?? null)) changes.city = this.draftCity();
    if (this.draftShowDesignSection() !== (config.showDesignSection ?? true)) changes.showDesignSection = this.draftShowDesignSection();
    if (this.draftShowLocationSection() !== (config.showLocationSection ?? true)) changes.showLocationSection = this.draftShowLocationSection();
    if (this.draftShowPaymentMethodsSection() !== (config.showPaymentMethodsSection ?? true)) changes.showPaymentMethodsSection = this.draftShowPaymentMethodsSection();
    if (this.draftCurrencySymbol() !== (config.currencySymbol ?? '$')) changes.currencySymbol = this.draftCurrencySymbol();

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
    const changes = this.getChangedFields();
    if (Object.keys(changes).length === 0) return;
    await this.configStore.updatePartialConfig(changes);
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
