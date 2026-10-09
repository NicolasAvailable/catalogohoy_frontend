import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { PlanStore } from '@catalogohoy/plan';
import { getTenantSlugFromUrl, TenantStore } from '@catalogohoy/tenant';
import { IconComponent } from '@ui';
import { canConnectChannels } from '../../../domain';

/** Landing de "Chat" (estilo Chat Nube): pantalla de bienvenida que se muestra
 *  cuando el catálogo todavía no conectó ningún canal. Explica qué se puede
 *  hacer administrando a los clientes desde la misma plataforma (WhatsApp
 *  Business y TikTok, sin IA por ahora), muestra una **captura real** de la
 *  bandeja (tomada de una cuenta demo con chats de WhatsApp y TikTok) y lleva a
 *  "Configurar Chat" → conectar canales. Si el plan no incluye el CRM, el CTA
 *  se muestra deshabilitado con el aviso de plan (sin modal). Apenas se conecta
 *  un canal, la vista de conversaciones muestra la bandeja en lugar de esta
 *  landing. */
@Component({
  selector: 'lib-chat-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, TranslocoPipe],
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto bg-lino-400' },
  templateUrl: './chat-landing.html',
})
export class ChatLandingComponent implements OnInit {
  private readonly planStore = inject(PlanStore);
  private readonly tenantStore = inject(TenantStore);

  /** CTA bloqueado cuando el plan ya cargó y no incluye el CRM. Mientras el
   *  plan carga se muestra habilitado: navega al hub Conectar, que gatea
   *  igual (así no le flasheamos el candado a un Avanzado). */
  protected readonly locked = computed(() => {
    const slug = getTenantSlugFromUrl() || this.tenantStore.tenantSlug() || '';
    const planId = this.planStore.currentPlan()?.id ?? '';
    return !!planId && !canConnectChannels(slug, planId);
  });

  ngOnInit(): void {
    // El plan puede no estar cargado si se entra directo a esta ruta.
    this.planStore.loadTenantPlanUsage();
  }

  protected readonly features = [
    {
      icon: 'inbox',
      title: 'Todos tus chats en un solo lugar',
      description:
        'Recibe y responde los mensajes de tus clientes sin cambiar de aplicación.',
    },
    {
      icon: 'contact',
      title: 'Conoce a tu cliente mientras chateas',
      description:
        'Ve su historial de pedidos y sus datos al lado de la conversación.',
    },
    {
      icon: 'users',
      title: 'Trabaja en equipo',
      description:
        'Asigna conversaciones a tu equipo y deja notas internas en cada chat.',
    },
    {
      icon: 'image',
      title: 'Envía fotos y archivos',
      description:
        'Comparte imágenes y comprobantes directo desde la bandeja.',
    },
  ];
}
