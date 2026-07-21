import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantStore } from '@catalogohoy/tenant';
import { ButtonComponent, IconComponent } from '@ui';
import { WhatsAppConnectChecklist } from '../../../domain';
import {
  EmbeddedSignupData,
  FacebookSdkService,
  WhatsAppConnectMode,
  WhatsAppService,
  WhatsAppStore,
} from '../../../infrastructure';

/** Página "Conectar a WhatsApp Business" (estilo TakeApp): el comerciante
 *  elige CÓMO conectar su número — coexistencia (conserva su app de WhatsApp
 *  en el teléfono, mensajes espejados) o solo API (número dedicado) — repasa
 *  una lista de verificación y lanza el Embedded Signup de Meta. */
@Component({
  selector: 'lib-whatsapp-connect',
  standalone: true,
  imports: [ButtonComponent, IconComponent, TranslocoPipe],
  templateUrl: './whatsapp-connect.html',
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto' },
})
export class WhatsAppConnectComponent implements OnInit {
  readonly whatsAppStore = inject(WhatsAppStore);

  private readonly facebookSdk = inject(FacebookSdkService);
  private readonly whatsAppService = inject(WhatsAppService);
  private readonly tenantStore = inject(TenantStore);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly sdkReady = signal(false);
  readonly mode = signal<WhatsAppConnectMode>('coexistence');
  readonly policiesAccepted = signal(false);
  readonly checklist = signal<WhatsAppConnectChecklist | null>(null);
  readonly isLoadingChecklist = signal(true);

  readonly canConnect = computed(
    () =>
      this.sdkReady() &&
      this.policiesAccepted() &&
      !this.whatsAppStore.isConnecting()
  );

  /** Mínimo de productos visibles que sugerimos antes de conectar (Meta puede
   *  revisar el negocio durante el onboarding de la WABA). */
  readonly minProducts = 3;

  private removeMessageListener?: () => void;

  // El Embedded Signup entrega el `code` por el callback de FB.login y el
  // `waba_id`/`phone_number_id` por un postMessage (orden no garantizado). Los
  // juntamos acá y recién con ambos completamos el alta.
  private pendingCode: string | null = null;
  private pendingData: EmbeddedSignupData | null = null;

  ngOnInit(): void {
    this.facebookSdk.loadSdk().then(() => this.sdkReady.set(true));
    this.loadChecklist();

    this.removeMessageListener = this.facebookSdk.onEmbeddedSignupMessage(
      (event) => {
        // El flujo estándar emite FINISH; el de coexistencia emite su propia
        // variante. Ambos traen waba_id + phone_number_id.
        if (
          event.event === 'FINISH' ||
          event.event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'
        ) {
          this.pendingData = event.data;
          this.tryComplete();
        }
      }
    );

    this.destroyRef.onDestroy(() => this.removeMessageListener?.());
  }

  setMode(mode: WhatsAppConnectMode): void {
    this.mode.set(mode);
  }

  togglePolicies(): void {
    this.policiesAccepted.set(!this.policiesAccepted());
  }

  goBack(): void {
    this.router.navigate(['/admin/chat/conversations']);
  }

  goToProducts(): void {
    this.router.navigate(['/admin/products']);
  }

  goToCatalogConfig(): void {
    this.router.navigate(['/admin/e-commerce']);
  }

  async connect(): Promise<void> {
    if (!this.canConnect()) return;

    this.pendingCode = null;
    this.pendingData = null;

    const response = await this.facebookSdk.launchEmbeddedSignup(this.mode());

    if (response.status !== 'connected' || !response.authResponse?.code) {
      return;
    }

    this.pendingCode = response.authResponse.code;
    this.tryComplete();
  }

  private async loadChecklist(): Promise<void> {
    this.isLoadingChecklist.set(true);
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.isLoadingChecklist.set(false);
      return;
    }

    const result = await this.whatsAppService.getConnectChecklist(tenantId);
    result.fold(
      () => this.isLoadingChecklist.set(false),
      (checklist) => {
        this.checklist.set(checklist);
        this.isLoadingChecklist.set(false);
      }
    );
  }

  /** Cuando ya tenemos el `code` Y los ids de la WABA, completa el alta vía
   *  `wa-onboard` (el backend intercambia el code por el token). */
  private async tryComplete(): Promise<void> {
    if (!this.pendingCode || !this.pendingData) return;

    const data = this.pendingData;
    const code = this.pendingCode;
    this.pendingCode = null;
    this.pendingData = null;

    const account = await this.whatsAppStore.registerFromEmbeddedSignup({
      wabaId: data.waba_id,
      phoneNumberId: data.phone_number_id,
      authCode: code,
    });

    if (account) {
      this.router.navigate(['/admin/chat/conversations']);
    }
  }
}
