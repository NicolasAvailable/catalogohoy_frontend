import {
  ChangeDetectionStrategy,
  Component,
  OnDestroy,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe, translate } from '@jsverse/transloco';
import { toast as sonnerToast } from 'ngx-sonner';
import { META_CHANNEL_ALLOWED_SLUGS } from '@catalogohoy/core';
import { PlanStore } from '@catalogohoy/plan';
import { TenantStore, getTenantSlugFromUrl } from '@catalogohoy/tenant';
import { ButtonComponent, IconComponent, SelectComponent } from '@ui';
import { MetaCatalogSync } from '../../domain';
import { EcommerceConfigService } from '../../infrastructure';

// key-as-text: los mensajes son keys de transloco y ngx-sonner no traduce solo.
const toast = {
  success: (msg: string) => sonnerToast.success(translate(msg)),
  error: (msg: string) => sonnerToast.error(translate(msg)),
};

/**
 * Canal "Instagram y Facebook" (CAT-64/65): landing del canal Meta estilo
 * TiendaNube. Desconectado muestra el hero + beneficios con CTA "Conectar con
 * Meta"; conectado muestra las tres piezas del canal (conexión, catálogo,
 * píxel/CAPI) con sus acciones. Gateado por META_CHANNEL_ALLOWED_SLUGS hasta
 * pasar el App Review de Meta.
 */
@Component({
  selector: 'lib-meta-channel',
  imports: [
    FormsModule,
    DatePipe,
    TranslocoPipe,
    ButtonComponent,
    IconComponent,
    SelectComponent,
  ],
  templateUrl: './meta-channel.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MetaChannelView implements OnInit, OnDestroy {
  private readonly configService = inject(EcommerceConfigService);
  private readonly tenantStore = inject(TenantStore);
  private readonly planStore = inject(PlanStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  private tenantId: string | null = null;

  /** Bullets del hero (mismo patrón que la landing de Chat). */
  public readonly features = [
    {
      title: 'Tu catálogo, sincronizado solo',
      description:
        'Precios, fotos, variantes y stock siempre al día en Facebook e Instagram. Cambiás algo en CatalogoHoy y se refleja allá.',
    },
    {
      title: 'Etiquetá productos en tus publicaciones',
      description:
        'Tus posts y stories con etiqueta de producto: tus clientes tocan y van directo a tu catálogo.',
    },
    {
      title: 'Píxel y Conversions API sin configurar nada',
      description:
        'La medición de visitas, carritos y pedidos queda activa sola, lista para tus campañas y públicos.',
    },
    {
      title: 'Anuncios dinámicos que venden',
      description:
        'Meta le muestra a cada persona el producto que le interesa de tu catálogo, como hacen las marcas grandes.',
    },
  ];

  /** Función de planes pagos (mismo gating que el Píxel manual). */
  public readonly isLocked = computed(() => this.planStore.currentPlan()?.isFree ?? false);

  public readonly isLoading = signal(true);
  // Conexión
  public readonly metaConnected = signal(false);
  public readonly metaBusinessName = signal<string | null>(null);
  public readonly metaBusinessId = signal<string | null>(null);
  public readonly metaBusinesses = signal<{ id: string; name: string }[]>([]);
  public readonly isConnectingMeta = signal(false);
  // Catálogo
  public readonly metaCatalogId = signal<string | null>(null);
  public readonly metaCatalogSync = signal<MetaCatalogSync | null>(null);
  public readonly isProvisioningCatalog = signal(false);
  public readonly isSyncingCatalog = signal(false);
  // Píxel + CAPI
  public readonly metaPixelId = signal<string | null>(null);
  public readonly metaCapiOk = signal(false);
  public readonly isProvisioningPixel = signal(false);
  /** true cuando ya llegó el primer estado de la Graph API (evita el flash de
   *  "configurar" mientras carga). */
  public readonly statusLoaded = signal(false);
  /** Ingesta del feed en curso: la página se auto-actualiza hasta que Meta
   *  termina de procesar los productos (sin recargar). */
  public readonly isPollingSync = signal(false);
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  public readonly metaBusinessOptions = computed(() =>
    this.metaBusinesses().map((b) => ({ label: b.name, value: b.id }))
  );
  public readonly metaCommerceUrl = computed(() => {
    const id = this.metaCatalogId();
    return id
      ? `https://business.facebook.com/commerce/catalogs/${id}/products`
      : null;
  });

  async ngOnInit(): Promise<void> {
    // Allowlist hasta el App Review: fuera de ella el canal no existe.
    const slug = getTenantSlugFromUrl();
    if (
      META_CHANNEL_ALLOWED_SLUGS !== null &&
      !META_CHANNEL_ALLOWED_SLUGS.includes(slug ?? '')
    ) {
      this.router.navigate(['/admin']);
      return;
    }
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;
    this.tenantId = String(tenantId);
    this.handleMetaReturn();
    await this.loadConnection();
    this.isLoading.set(false);
  }

  private async loadConnection(): Promise<void> {
    if (!this.tenantId) return;
    const result = await this.configService.getMetaConnectionStatus(this.tenantId);
    result.mapRight((s) => {
      this.metaConnected.set(s.connected);
      this.metaBusinessName.set(s.businessName);
      this.metaBusinessId.set(s.businessId);
      this.metaBusinesses.set(s.businesses);
      this.metaCatalogId.set(s.catalogId);
      // El detalle (conteo, ingesta, pixel) llama a la Graph API: async y sin
      // bloquear el render.
      if (s.connected) this.loadChannelStatus();
    });
  }

  private async loadChannelStatus(): Promise<void> {
    if (!this.tenantId) return;
    const result = await this.configService.getMetaCatalogStatus(this.tenantId);
    result.mapRight((s) => {
      this.metaCatalogSync.set(s.sync);
      this.metaPixelId.set(s.pixelId);
      this.metaCapiOk.set(s.capiOk);
    });
    this.statusLoaded.set(true);
  }

  ngOnDestroy(): void {
    this.stopSyncPolling();
  }

  /** Meta ingiere el feed de forma asíncrona (~15-30s): tras publicar o
   *  sincronizar, refrescamos el estado cada 5s hasta ver el resultado nuevo
   *  (o cortar a los 2 min), así el conteo aparece solo, sin recargar. */
  private startSyncPolling(): void {
    this.stopSyncPolling();
    this.isPollingSync.set(true);
    const startedAt = Date.now();
    const before = JSON.stringify({
      c: this.metaCatalogSync()?.productCount ?? null,
      t: this.metaCatalogSync()?.lastSyncEnd ?? null,
    });
    this.pollTimer = setInterval(async () => {
      await this.loadChannelStatus();
      const sync = this.metaCatalogSync();
      const now = JSON.stringify({ c: sync?.productCount ?? null, t: sync?.lastSyncEnd ?? null });
      const finished = now !== before && (sync?.productCount ?? 0) > 0;
      if (finished || Date.now() - startedAt > 120_000) this.stopSyncPolling();
    }, 5000);
  }

  private stopSyncPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
    this.isPollingSync.set(false);
  }

  /** Al volver del OAuth de Meta, mostramos el resultado y limpiamos el query. */
  private handleMetaReturn(): void {
    const meta = this.route.snapshot.queryParamMap.get('meta');
    if (!meta) return;
    if (meta === 'connected') {
      toast.success('Meta conectado correctamente');
    } else if (meta === 'connected_nobusiness') {
      toast.success(
        'Meta conectado. No encontramos un Business Manager; creá uno para publicar el catálogo.'
      );
    } else if (meta === 'error') {
      toast.error('No se pudo conectar con Meta. Intentá de nuevo.');
    }
    this.router.navigate([], {
      queryParams: { meta: null },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  public async connectMeta(): Promise<void> {
    if (!this.tenantId || this.isConnectingMeta() || this.isLocked()) return;
    this.isConnectingMeta.set(true);
    const result = await this.configService.startMetaConnect(
      this.tenantId,
      window.location.href
    );
    result.fold(
      (err) => {
        toast.error(err.message || 'No se pudo iniciar la conexión con Meta');
        this.isConnectingMeta.set(false);
      },
      (url) => {
        window.location.href = url;
      }
    );
  }

  public async disconnectMeta(): Promise<void> {
    if (!this.tenantId) return;
    const result = await this.configService.disconnectMeta(this.tenantId);
    result.fold(
      () => {
        toast.error('No se pudo desconectar Meta');
      },
      () => {
        this.metaConnected.set(false);
        this.metaBusinessName.set(null);
        this.metaBusinessId.set(null);
        this.metaBusinesses.set([]);
        this.metaCatalogId.set(null);
        this.metaCatalogSync.set(null);
        this.metaPixelId.set(null);
        this.metaCapiOk.set(false);
        toast.success('Meta desconectado');
      }
    );
  }

  public async changeMetaBusiness(businessId: string | null): Promise<void> {
    if (!this.tenantId || !businessId || businessId === this.metaBusinessId()) return;
    const result = await this.configService.selectMetaBusiness(this.tenantId, businessId);
    result.fold(
      (err) => {
        toast.error(err.message || 'No se pudo cambiar el portfolio');
      },
      () => {
        this.metaBusinessId.set(businessId);
        this.metaBusinessName.set(
          this.metaBusinesses().find((b) => b.id === businessId)?.name ?? null
        );
        this.metaCatalogId.set(null);
        this.metaCatalogSync.set(null);
      }
    );
  }

  public async publishMetaCatalog(): Promise<void> {
    if (!this.tenantId || this.isProvisioningCatalog()) return;
    this.isProvisioningCatalog.set(true);
    const result = await this.configService.provisionMetaCatalog(this.tenantId);
    result.fold(
      (err) => {
        toast.error(err.message || 'No se pudo publicar el catálogo en Meta');
      },
      (sync) => {
        this.metaCatalogId.set(sync?.catalogId ?? null);
        this.metaCatalogSync.set(sync);
        toast.success(
          'Catálogo publicado en Meta. Tus productos se sincronizan todos los días.'
        );
        this.startSyncPolling();
      }
    );
    this.isProvisioningCatalog.set(false);
  }

  public async syncMetaCatalogNow(): Promise<void> {
    if (!this.tenantId || this.isSyncingCatalog()) return;
    this.isSyncingCatalog.set(true);
    const result = await this.configService.syncMetaCatalog(this.tenantId);
    result.fold(
      (err) => {
        toast.error(err.message || 'No se pudo sincronizar el catálogo');
      },
      () => {
        toast.success('Sincronización solicitada. Meta puede tardar unos minutos.');
        this.startSyncPolling();
      }
    );
    this.isSyncingCatalog.set(false);
  }

  public async provisionMetaPixel(): Promise<void> {
    if (!this.tenantId || this.isProvisioningPixel()) return;
    this.isProvisioningPixel.set(true);
    const result = await this.configService.provisionMetaPixel(this.tenantId);
    result.fold(
      (err) => {
        toast.error(err.message || 'No se pudo configurar el Píxel');
        // Términos del Píxel sin aceptar: es un paso único en Meta — lo abrimos.
        if (err.tosUrl) window.open(err.tosUrl, '_blank', 'noopener');
      },
      (pixelId) => {
        this.metaPixelId.set(pixelId);
        this.metaCapiOk.set(true);
        toast.success('Píxel configurado. El seguimiento y la CAPI quedaron activos.');
      }
    );
    this.isProvisioningPixel.set(false);
  }
}

export default MetaChannelView;
