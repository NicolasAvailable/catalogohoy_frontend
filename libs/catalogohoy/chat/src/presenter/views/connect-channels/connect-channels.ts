import {
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { translate, TranslocoPipe } from '@jsverse/transloco';
import { PlanStore } from '@catalogohoy/plan';
import { getTenantSlugFromUrl, TenantStore } from '@catalogohoy/tenant';
import { WhatsAppService, WhatsAppStore } from '@catalogohoy/whatsapp';
import { NgClass } from '@angular/common';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ConfirmDialogService, IconComponent } from '@ui';
import { canConnectChannels } from '../../../domain';

/** Instagram YA está aprobado por Meta (instagram_business_basic +
 *  instagram_business_manage_messages, App Review 2026-09-14) y la app está en
 *  Live → su card es PÚBLICA para todo catálogo con plan habilitado. Messenger
 *  sigue en beta cerrada: su App Review propio (pages_messaging /
 *  pages_manage_metadata) todavía NO está aprobado, así que solo estos slugs lo
 *  ven. Quitar este gate cuando Meta apruebe esa review. */
const MESSENGER_CONNECT_SLUGS: string[] = ['catalogohoy-demo', 'catalogohoy'];

/** Canal conectable desde el hub (estilo galería de SocialGest). */
interface ConnectableChannel {
  key: 'whatsapp' | 'instagram' | 'messenger' | 'tiktok';
  name: string;
  logo: string;
  description: string;
  route: string;
  /** Card deshabilitada con badge "Próximamente" (canal aún no lanzado). */
  comingSoon?: boolean;
}

/** Cuenta social conectada (IG/TikTok) con sus columnas públicas. */
type SocialAccount = { username: string | null; displayName: string | null };

/** Hub "Conectar": las redes que el CRM puede conectar, cada una como card
 *  que lleva a su pantalla de conexión dedicada y muestra la cuenta conectada. */
@Component({
  selector: 'lib-connect-channels',
  standalone: true,
  imports: [NgClass, RouterLink, IconComponent, TranslocoPipe],
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto' },
  templateUrl: './connect-channels.html',
})
export class ConnectChannelsComponent implements OnInit {
  protected readonly whatsAppStore = inject(WhatsAppStore);
  private readonly whatsAppService = inject(WhatsAppService);
  private readonly tenantStore = inject(TenantStore);
  private readonly planStore = inject(PlanStore);
  private readonly confirmDialog = inject(ConfirmDialogService);
  private readonly toast = inject(ToastService);

  /** Conectar canales es una función de los planes avanzados. Los catálogos
   *  internos (allowlist) pueden conectar igual para demo / App Review. */
  protected readonly canConnect = computed(() => {
    const slug = getTenantSlugFromUrl() || this.tenantStore.tenantSlug() || '';
    return canConnectChannels(slug, this.planStore.currentPlan()?.id ?? '');
  });

  /** Aviso "necesitás Avanzado" bajo el header: solo cuando el plan ya cargó
   *  y no incluye el CRM (evita flashearle el upsell a un Avanzado mientras
   *  carga el plan). */
  protected readonly showPlanNote = computed(
    () => !!this.planStore.currentPlan() && !this.canConnect()
  );

  /** Canal cuya desvinculación está en vuelo (spinner por card). */
  protected readonly disconnectingKey = signal<string | null>(null);

  protected readonly igAccount = signal<SocialAccount | null>(null);
  protected readonly ttAccount = signal<SocialAccount | null>(null);
  protected readonly fbAccount = signal<SocialAccount | null>(null);

  /** Canales de la galería: WhatsApp, Instagram y TikTok son públicos (los tres
   *  conectables, gateados por plan vía canConnect()). Messenger solo aparece
   *  para la allowlist de su beta cerrada hasta que Meta apruebe su review. */
  protected readonly channels = computed<ConnectableChannel[]>(() => {
    const slug = getTenantSlugFromUrl() || this.tenantStore.tenantSlug() || '';
    const messengerUnlocked = MESSENGER_CONNECT_SLUGS.includes(slug);
    const list: ConnectableChannel[] = [
      {
        key: 'whatsapp',
        name: 'WhatsApp Business',
        logo: '/images/whatsapp.svg',
        description: 'Recibe y responde los chats de tu número de empresa.',
        route: '/admin/chat/connect/whatsapp',
      },
      {
        key: 'instagram',
        name: 'Instagram',
        logo: '/images/instagram.svg',
        description: 'Responde los mensajes directos de tu cuenta profesional.',
        route: '/admin/chat/connect/instagram',
      },
      {
        key: 'tiktok',
        name: 'TikTok',
        // Nota colorida sin fondo (tiktok.svg es la versión app-icon con fondo
        // negro, para los badges chicos de la bandeja).
        logo: '/images/tiktok-logo.svg',
        description: 'Responde los mensajes directos de tu cuenta de empresa.',
        route: '/admin/chat/connect/tiktok',
      },
    ];
    if (messengerUnlocked) {
      list.push({
        key: 'messenger',
        name: 'Messenger',
        logo: '/images/messenger.svg',
        description: 'Responde los mensajes de Messenger de tu página de Facebook.',
        route: '/admin/chat/connect/messenger',
      });
    }
    return list;
  });

  protected readonly waConnected = computed(() =>
    this.whatsAppStore.hasActiveAccount()
  );

  ngOnInit(): void {
    // El plan puede no estar cargado si se entra directo a esta ruta (el aviso
    // de plan y el estado de las cards dependen de él).
    this.planStore.loadTenantPlanUsage();
    this.whatsAppStore.loadAccounts();
    this.loadSocialAccounts();
  }

  /** Click en una card: las "Próximamente" y las bloqueadas por plan no
   *  navegan (routeFor da null; el aviso de plan ya está visible en la
   *  pantalla, sin modal). Con plan válido el routerLink navega normalmente. */
  protected onChannelClick(channel: ConnectableChannel, event: Event): void {
    if (this.routeFor(channel) === null) event.preventDefault();
  }

  /** Destino del routerLink de la card: null si es "Próximamente" o el plan no
   *  habilita; si ya está conectado, a la bandeja de mensajes; si no, a la
   *  pantalla de conexión del canal. */
  protected routeFor(channel: ConnectableChannel): string | null {
    // Un canal ya conectado (incluido el demo) lleva a la bandeja aunque siga
    // marcado "Próximamente" para el resto de los usuarios.
    if (this.isConnected(channel)) return '/admin/chat/conversations';
    if (channel.comingSoon || !this.canConnect()) return null;
    return channel.route;
  }

  protected isConnected(channel: ConnectableChannel): boolean {
    if (channel.key === 'whatsapp') return this.waConnected();
    if (channel.key === 'instagram') return this.igAccount() !== null;
    if (channel.key === 'messenger') return this.fbAccount() !== null;
    return this.ttAccount() !== null;
  }

  /** Identidad visible de la cuenta conectada: número para WhatsApp, @usuario
   *  (o nombre) para las redes. */
  protected identityOf(channel: ConnectableChannel): string | null {
    if (channel.key === 'whatsapp') {
      const account = this.whatsAppStore.activeAccounts()[0];
      if (!account) return null;
      const phone = account.phoneNumber?.trim();
      const withPlus = phone
        ? phone.startsWith('+')
          ? phone
          : `+${phone}`
        : null;
      return account.displayName?.trim() || withPlus;
    }
    const account =
      channel.key === 'instagram'
        ? this.igAccount()
        : channel.key === 'messenger'
          ? this.fbAccount()
          : this.ttAccount();
    if (!account) return null;
    return account.username
      ? `@${account.username}`
      : account.displayName?.trim() || null;
  }

  private async loadSocialAccounts(): Promise<void> {
    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) return;
    const [ig, tt, fb] = await Promise.all([
      this.whatsAppService.getInstagramAccount(tenantId),
      this.whatsAppService.getTikTokAccount(tenantId),
      this.whatsAppService.getMessengerAccount(tenantId),
    ]);
    if (ig.isRight()) this.igAccount.set(ig.value);
    if (tt.isRight()) this.ttAccount.set(tt.value);
    if (fb.isRight()) this.fbAccount.set(fb.value);
  }

  /** Desvincular con confirmación: la cuenta pasa a inactiva pero los chats y
   *  datos quedan almacenados; se puede volver a conectar cuando quiera. */
  confirmDisconnect(channel: ConnectableChannel, event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    const identity = this.identityOf(channel) ?? channel.name;
    this.confirmDialog
      .warning({
        headerLabel: translate('¿Desvincular {name}?', { name: channel.name }),
        target: identity,
        contentLabel:
          'Se desconectará la cuenta de tu bandeja. Tus chats y datos se conservan, y puedes volver a conectarla cuando quieras.',
        acceptLabel: 'Desvincular',
        rejectLabel: 'Cancelar',
      })
      .subscribe((result) => {
        result.mapRight(() => this.disconnect(channel));
      });
  }

  private async disconnect(channel: ConnectableChannel): Promise<void> {
    if (this.disconnectingKey()) return;
    this.disconnectingKey.set(channel.key);
    this.toast.wait('Desvinculando...');

    if (channel.key === 'whatsapp') {
      const account = this.whatsAppStore.activeAccounts()[0];
      if (!account) {
        this.disconnectingKey.set(null);
        this.toast.dismissWait();
        return;
      }
      const result = await this.whatsAppService.updateAccount(account.id, {
        status: 'inactive',
      });
      this.disconnectingKey.set(null);
      if (result.isLeft()) {
        this.toast.error(new Exception('No se pudo desvincular la cuenta'));
        return;
      }
      this.whatsAppStore.loadAccounts();
      this.toast.success('WhatsApp desvinculado. Tus chats quedan guardados.');
      return;
    }

    const tenantId = await this.tenantStore.getTenantIdAsync();
    if (!tenantId) {
      this.disconnectingKey.set(null);
      this.toast.dismissWait();
      return;
    }
    const result = await this.whatsAppService.disconnectSocialAccount(
      tenantId,
      channel.key
    );
    this.disconnectingKey.set(null);
    if (result.isLeft()) {
      this.toast.error(new Exception('No se pudo desvincular la cuenta'));
      return;
    }
    if (channel.key === 'instagram') this.igAccount.set(null);
    else if (channel.key === 'messenger') this.fbAccount.set(null);
    else this.ttAccount.set(null);
    this.toast.success('Cuenta desvinculada. Tus chats quedan guardados.');
  }
}
