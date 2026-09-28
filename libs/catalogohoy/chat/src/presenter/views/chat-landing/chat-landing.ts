import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';

/** Landing de "Chat" (estilo Chat Nube): pantalla de bienvenida que se muestra
 *  cuando el catálogo todavía no conectó ningún canal. Explica qué se puede
 *  hacer administrando a los clientes desde la misma plataforma (WhatsApp
 *  Business y TikTok, sin IA por ahora), muestra una **captura real** de la
 *  bandeja (tomada de una cuenta demo con chats de WhatsApp y TikTok) y lleva a
 *  "Configurar Chat" → conectar canales. Apenas se conecta un canal, la vista de
 *  conversaciones muestra la bandeja en lugar de esta landing. */
@Component({
  selector: 'lib-chat-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, TranslocoPipe],
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto bg-lino-400' },
  templateUrl: './chat-landing.html',
})
export class ChatLandingComponent {
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
