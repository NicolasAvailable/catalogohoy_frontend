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
  CheckboxComponent,
  ColorPickerComponent,
  IconComponent,
  InputTextComponent,
  SelectComponent,
  TextareaComponent,
  ToggleComponent,
  UploaderComponent,
} from '@ui';
import {
  PaymentMethod,
  PAYMENT_METHOD_OPTIONS,
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
    CheckboxComponent,
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

  public readonly themeColors = THEME_COLORS;
  public readonly paymentMethodOptions = PAYMENT_METHOD_OPTIONS;
  public readonly venezuelanStates = VENEZUELAN_STATES;

  // Draft signals
  public readonly draftName = signal('');
  public readonly draftDescription = signal('');
  public readonly draftWhatsappButtons = signal<WhatsappButton[]>([]);
  public readonly draftThemeColor = signal('#10b981');
  public readonly draftPaymentMethods = signal<PaymentMethod[]>([]);
  public readonly draftState = signal<string | null>(null);
  public readonly draftCity = signal<string | null>(null);
  public readonly draftShowDesignSection = signal(true);
  public readonly draftShowLocationSection = signal(true);
  public readonly draftShowPaymentMethodsSection = signal(true);

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
        this.draftPaymentMethods.set(config.paymentMethods ?? []);
        this.draftState.set(config.state ?? null);
        this.draftCity.set(config.city ?? null);
        this.draftShowDesignSection.set(config.showDesignSection ?? true);
        this.draftShowLocationSection.set(config.showLocationSection ?? true);
        this.draftShowPaymentMethodsSection.set(
          config.showPaymentMethodsSection ?? true
        );
      }
    });

    // Send preview messages when drafts change
    effect(() => {
      const name = this.draftName();
      const themeColor = this.draftThemeColor();
      const showDesignSection = this.draftShowDesignSection();
      const logo = this.configStore.config()?.logo ?? null;
      const banner = this.configStore.config()?.banner ?? null;

      const message = {
        type: 'PREVIEW_UPDATE' as const,
        payload: { name, logo, banner, themeColor, showDesignSection },
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
  togglePaymentMethod(method: PaymentMethod) {
    const current = this.draftPaymentMethods();
    if (current.includes(method)) {
      this.draftPaymentMethods.set(current.filter((m) => m !== method));
    } else {
      this.draftPaymentMethods.set([...current, method]);
    }
  }

  isPaymentMethodSelected(method: PaymentMethod): boolean {
    return this.draftPaymentMethods().includes(method);
  }

  async savePaymentMethods() {
    await this.configStore.savePaymentMethods({
      paymentMethods: this.draftPaymentMethods(),
      showPaymentMethodsSection: this.draftShowPaymentMethodsSection(),
    });
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
