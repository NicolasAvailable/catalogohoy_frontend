import {
  AfterViewInit,
  Component,
  inject,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { ButtonComponent, DialogComponent, IconComponent } from '@ui';

// Clave del anuncio (por usuario autenticado, vía RPC has/mark_announcement_seen
// sobre user_announcement_views). Para re-anunciar una feature nueva, usar otra
// clave (ai_v2…).
const ANNOUNCEMENT_KEY = 'ai_v1';

/**
 * Modal de anuncio "Llegó la IA". Vive en el shell del admin (`app-base`) para
 * que aparezca en la primera vista que cargue el usuario, no solo en el Home.
 * El "visto" se trackea por `auth.uid()` en `user_announcement_views`, así que
 * funciona también para miembros de equipo (sin fila en public.users).
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

  private readonly aiAnnounce = viewChild<DialogComponent>('aiAnnounce');

  async ngAfterViewInit(): Promise<void> {
    try {
      // Esperar a que la sesión esté hidratada: si la RPC sale con auth.uid()
      // null (carga en frío), devolvería false y el modal se mostraría aunque
      // el usuario ya lo haya visto.
      const {
        data: { session },
      } = await this.supabase.auth.getSession();
      if (!session) return;

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

  public exploreAi(): void {
    this.markAnnouncementSeen();
    this.aiAnnounce()?.hide();
    this.router.navigate(['/admin/products/create']);
  }
}
