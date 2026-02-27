import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TenantStore, getTenantSlugFromUrl } from '@catalogohoy/tenant';
import {
  ButtonComponent,
  CardComponent,
  ColorPickerComponent,
  ConfirmDialogService,
  IconComponent,
  InputTextComponent,
  SelectComponent,
  TextareaComponent,
  ToggleComponent,
  UploaderComponent,
} from '@ui';
import {
  DEFAULT_SOCIAL_LINKS,
  SocialLinks,
  THEME_COLORS,
  VENEZUELAN_STATES,
  WhatsappButton,
} from '../../domain';
import { EcommerceConfigStore } from '../../infrastructure';
import { PhoneMockupComponent } from '../components/phone-mockup/phone-mockup';

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
    PhoneMockupComponent,
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

  public readonly themeColors = THEME_COLORS;
  public readonly venezuelanStates = VENEZUELAN_STATES;

  // New payment method form
  public readonly newMethodName = signal('');
  public readonly newMethodIcon = signal('wallet');

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

  // Computed
  public readonly isCustomColor = computed(
    () => !this.themeColors.some((c) => c.value === this.draftThemeColor())
  );

  // Mobile overlay
  public readonly isMockupOpen = signal(false);

  // iframe URL
  public safeIframeUrl: SafeResourceUrl = '';

  // Phone mockup refs
  public readonly phoneMockup = viewChild<PhoneMockupComponent>('phoneMockup');
  public readonly phoneMockupOverlay =
    viewChild<PhoneMockupComponent>('phoneMockupOverlay');

  constructor() {
    // Sync drafts from server config
    effect(() => {
      const config = this.configStore.config();
      if (config) {
        this.draftName.set(config.name ?? '');
        this.draftDescription.set(config.description ?? '');
        this.draftWhatsappButtons.set(
          config.whatsappButtons?.length
            ? config.whatsappButtons.map((b) => ({ ...b }))
            : [{ name: '', number: '' }]
        );
        this.draftThemeColor.set(config.themeColor ?? '#10b981');
        this.draftState.set(config.state ?? null);
        this.draftCity.set(config.city ?? null);
        this.draftShowDesignSection.set(config.showDesignSection ?? true);
        this.draftShowLocationSection.set(config.showLocationSection ?? true);
        this.draftShowPaymentMethodsSection.set(
          config.showPaymentMethodsSection ?? true
        );
        this.draftSocialLinks.set(
          config.socialLinks ?? { ...DEFAULT_SOCIAL_LINKS }
        );
      }
    });

    // Send preview messages when drafts change
    effect(() => {
      const name = this.draftName();
      const themeColor = this.draftThemeColor();
      const showDesignSection = this.draftShowDesignSection();
      const socialLinks = this.draftSocialLinks();
      const logo = this.configStore.config()?.logo ?? null;
      const banner = this.configStore.config()?.banner ?? null;

      const message = {
        type: 'PREVIEW_UPDATE' as const,
        payload: { name, logo, banner, themeColor, showDesignSection, socialLinks },
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
      this.configStore.loadConfig(String(tenantId));
      this.configStore.loadPaymentMethods(String(tenantId));
    }
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

  async saveDesignSection() {
    await this.configStore.saveDesignSection({
      showDesignSection: this.draftShowDesignSection(),
    });
  }

  // --- Location Section ---
  async saveLocationSection() {
    await this.configStore.saveLocationSection({
      state: this.draftState(),
      city: this.draftCity(),
      showLocationSection: this.draftShowLocationSection(),
    });
  }

  // --- Theme Color ---
  selectThemeColor(color: string) {
    this.draftThemeColor.set(color);
  }

  async saveThemeColor() {
    await this.configStore.saveThemeColor(this.draftThemeColor());
  }

  // --- Payment Methods ---
  async addPaymentMethod() {
    const name = this.newMethodName().trim();
    if (!name) return;
    await this.configStore.addPaymentMethod(name, this.newMethodIcon());
    this.newMethodName.set('');
    this.newMethodIcon.set('wallet');
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

  async savePaymentMethodsSection() {
    await this.configStore.savePaymentMethodsSection(
      this.draftShowPaymentMethodsSection()
    );
  }

  // --- Identity Section ---
  async saveIdentity() {
    await this.configStore.updatePartialConfig({
      name: this.draftName(),
      description: this.draftDescription(),
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

  async saveWhatsappButtons() {
    await this.configStore.updatePartialConfig({
      whatsappButtons: this.draftWhatsappButtons(),
    });
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

  async saveSocialLinks() {
    await this.configStore.updatePartialConfig({ socialLinks: this.draftSocialLinks() });
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
