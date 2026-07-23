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

    const query = new URLSearchParams(window.location.search);
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
    // De vuelta al hub de canales (la vista "Conectar" del CRM).
    this.router.navigate(['/admin/chat/connect']);
  }

  goToProducts(): void {
    this.router.navigate(['/admin/products']);
  }

  goToCatalogConfig(): void {
    this.router.navigate(['/admin/e-commerce']);
  }

  /** El Embedded Signup corre en el dominio puente (conectar.catalogohoy.com):
   *  el SDK JS de Facebook exige dominios exactos y los catálogos viven en
   *  subdominios/dominios propios. wa-onboard firma el state (tenant+retorno).
   *
   *  El puente se abre como POPUP sobre el dashboard (&auto=1 intenta lanzar
   *  el asistente de Facebook solo); al conectar avisa por postMessage y este
   *  wizard navega al hub de canales. Si el navegador bloquea el popup, cae
   *  al flujo de página completa. */
  async connect(): Promise<void> {
    if (!this.canConnect()) return;
    this.isStarting.set(true);

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.isStarting.set(false);
      return;
    }

    // Retorno del flujo de página completa: el hub de canales conectados.
    const returnUrl = `${window.location.origin}/admin/chat/connect`;
    const result = await this.whatsAppService.startWhatsAppConnect(
      tenantId,
      returnUrl,
      this.mode()
    );
    result.fold(
      () => this.isStarting.set(false),
      (url) => this.openBridgePopup(`${url}&popup=1&auto=1`, url)
    );
  }

  /** Popup centrado sobre el dashboard; fallback a redirect si lo bloquean. */
  private openBridgePopup(popupUrl: string, fallbackUrl: string): void {
    const width = 560;
    const height = 760;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    const popup = window.open(
      popupUrl,
      'catalogohoy-wa-bridge',
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`
    );
    if (!popup) {
      window.location.href = fallbackUrl;
      return;
    }

    window.addEventListener('message', this.onBridgeMessage);
    // Si cierran el popup sin terminar, liberar el botón.
    const watcher = setInterval(() => {
      if (popup.closed) {
        clearInterval(watcher);
        this.isStarting.set(false);
      }
    }, 800);
    this.destroyRef.onDestroy(() => {
      clearInterval(watcher);
      window.removeEventListener('message', this.onBridgeMessage);
    });
  }

  /** El puente avisa al conectar → refrescar cuentas e ir al hub de canales. */
  private readonly onBridgeMessage = (event: MessageEvent): void => {
    if (event.data !== 'catalogohoy:wa-connected') return;
    window.removeEventListener('message', this.onBridgeMessage);
    this.isStarting.set(false);
    this.whatsAppStore.loadAccounts();
    this.router.navigate(['/admin/chat/connect']);
  };

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
