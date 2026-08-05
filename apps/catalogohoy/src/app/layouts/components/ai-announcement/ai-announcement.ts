import {
  AfterViewInit,
  Component,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { getTenantSlugFromUrl, TenantStore } from '@catalogohoy/tenant';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent, DialogComponent, IconComponent } from '@ui';
import {
  CHAT_ENABLED_SLUGS,
  CHAT_PLAN_GATING_LIVE,
} from '../../../modules/admin/chat-enabled.guard';

// Clave del anuncio (por usuario autenticado, vía RPC has/mark_announcement_seen
// sobre user_announcement_views). Cambiar la clave re-anuncia la feature a todos.
const ANNOUNCEMENT_KEY = 'connect_channels_v1';

// 🚦 Switch maestro: en false el modal NO se muestra a nadie. Apagado por
// decisión — ya no anunciamos la integración de WhatsApp con este modal.
// Poner en true (o cambiar ANNOUNCEMENT_KEY) para volver a mostrarlo.
const ANNOUNCEMENT_ENABLED = false;

/**
 * Modal de anuncio "Conectá WhatsApp Business". Vive en el shell del admin
 * (`app-base`) para que aparezca en la primera vista que cargue el usuario.
 * Solo se muestra a los catálogos que YA pueden usar el módulo de Chats
 * (allowlist interna o, cuando el gating esté live, los planes incluidos), para
 * no prometer una función que el catálogo todavía no tiene disponible.
 * El "visto" se trackea por `auth.uid()` en `user_announcement_views`.
 */
@Component({
  selector: 'app-ai-announcement',
  standalone: true,
  imports: [IconComponent, ButtonComponent, DialogComponent, TranslocoPipe],
  templateUrl: './ai-announcement.html',
})
export class AiAnnouncement implements AfterViewInit {
  private readonly router = inject(Router);
  private readonly supabase = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);

  private readonly aiAnnounce = viewChild<DialogComponent>('aiAnnounce');

  /** Se muestra el anuncio a TODOS los catálogos cuando el CRM está lanzado
   *  ({@link CHAT_PLAN_GATING_LIVE}); la validación por plan se aplica al
   *  conectar, no en el anuncio. {@link CHAT_ENABLED_SLUGS} lo fuerza aunque no
   *  esté lanzado. */
  private readonly tenantHasChat = computed(() => {
    const slug = getTenantSlugFromUrl() || this.tenantStore.tenantSlug() || '';
    if (CHAT_ENABLED_SLUGS.includes(slug)) return true;
    return CHAT_PLAN_GATING_LIVE;
  });

  async ngAfterViewInit(): Promise<void> {
    // Anuncio apagado hasta el lanzamiento del CRM (ver ANNOUNCEMENT_ENABLED).
    if (!ANNOUNCEMENT_ENABLED) return;
    try {
      // Esperar a que la sesión esté hidratada: si la RPC sale con auth.uid()
      // null (carga en frío), devolvería false y el modal se mostraría aunque
      // el usuario ya lo haya visto.
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      if (!session) return;

      // Solo a catálogos con el módulo disponible (no prometer lo que no tienen).
      if (!this.tenantHasChat()) return;

      const { data, error } = await this.supabase.rpc('has_seen_announcement', {
        p_key: ANNOUNCEMENT_KEY,
      });
      if (!error && data === false) this.aiAnnounce()?.show();
    } catch {
      /* si falla la consulta, no mostramos para no molestar */
    }
  }

  private markAnnouncementSeen(): void {
    // Fire-and-forget; la RPC es idempotente (on conflict do nothing).
    this.supabase
      .rpc('mark_announcement_seen', { p_key: ANNOUNCEMENT_KEY })
      .then(
        () => undefined,
        () => undefined
      );
  }

  /** El diálogo se cerró (X, máscara o escape): también cuenta como visto. */
  public onAnnouncementClose(): void {
    this.markAnnouncementSeen();
  }

  public closeAnnouncement(): void {
    this.markAnnouncementSeen();
    this.aiAnnounce()?.hide();
  }

  public goToConnect(): void {
    this.markAnnouncementSeen();
    this.aiAnnounce()?.hide();
    this.router.navigate(['/admin/chat/connect']);
  }
}
