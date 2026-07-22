import {
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TenantStore } from '@catalogohoy/tenant';
import { ButtonComponent, CheckboxComponent, IconComponent } from '@ui';
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
  imports: [ButtonComponent, CheckboxComponent, FormsModule, IconComponent, TranslocoPipe],
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

  // ── Instagram (bandeja omnicanal) ──
  readonly igAccount = signal<{ username: string | null; displayName: string | null } | null>(null);
  readonly isConnectingIg = signal(false);
  /** Resultado del retorno del OAuth (?ig=connected | ?ig=error). */
  readonly igStatus = signal<'connected' | 'error' | null>(null);

  /** Estado del retorno del puente (?wa=connected). */
  readonly waStatus = signal<'connected' | null>(null);
  readonly isStarting = signal(false);

  readonly canConnect = computed(
    () => this.policiesAccepted() && !this.isStarting()
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
    this.loadIgAccount();

    const query = new URLSearchParams(window.location.search);
    const igParam = query.get('ig');
    if (igParam === 'connected' || igParam === 'error') {
      this.igStatus.set(igParam);
    }
    if (query.get('wa') === 'connected') {
      this.waStatus.set('connected');
      this.whatsAppStore.loadAccounts();
    }

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

  goBack(): void {
    this.router.navigate(['/admin/chat/conversations']);
  }

  goToProducts(): void {
    this.router.navigate(['/admin/products']);
  }

  goToCatalogConfig(): void {
    this.router.navigate(['/admin/e-commerce']);
  }

  /** El Embedded Signup corre en el dominio puente (conectar.catalogohoy.com):
   *  el SDK JS de Facebook exige dominios exactos y los catálogos viven en
   *  subdominios/dominios propios. wa-onboard firma el state (tenant+retorno). */
  async connect(): Promise<void> {
    if (!this.canConnect()) return;
    this.isStarting.set(true);

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.isStarting.set(false);
      return;
    }

    const returnUrl = `${window.location.origin}/admin/chat/connect`;
    const result = await this.whatsAppService.startWhatsAppConnect(
      tenantId,
      returnUrl,
      this.mode()
    );
    result.fold(
      () => this.isStarting.set(false),
      (url) => {
        window.location.href = url;
      }
    );
  }

  private async loadIgAccount(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;
    const result = await this.whatsAppService.getInstagramAccount(tenantId);
    result.fold(
      () => undefined,
      (account) => this.igAccount.set(account)
    );
  }

  /** Abre el Instagram Login (redirect server-side vía ig-oauth — funciona
   *  desde cualquier dominio del cliente, sin lista de dominios del SDK). */
  async connectInstagram(): Promise<void> {
    if (this.isConnectingIg()) return;
    this.isConnectingIg.set(true);

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.isConnectingIg.set(false);
      return;
    }

    // Al volver del login aterriza en la bandeja con la conversación de IG
    // abierta (chat-layout selecciona el chat de Instagram con ?ig=connected).
    const returnUrl = `${window.location.origin}/admin/chat/conversations`;
    const result = await this.whatsAppService.startInstagramConnect(tenantId, returnUrl);
    result.fold(
      () => {
        this.igStatus.set('error');
        this.isConnectingIg.set(false);
      },
      (url) => {
        window.location.href = url;
      }
    );
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
