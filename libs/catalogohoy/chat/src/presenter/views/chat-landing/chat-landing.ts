import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';

/** Landing de "Chat" (estilo Chat Nube): pantalla de bienvenida que se muestra
 *  cuando el catálogo todavía no conectó ningún canal. Explica qué se puede
 *  hacer administrando a los clientes desde la misma plataforma (WhatsApp
 *  Business y TikTok, sin IA por ahora), muestra un **mockup** de cómo se ve la
 *  bandeja y lleva a "Configurar Chat" → conectar canales. Apenas se conecta un
 *  canal, la vista de conversaciones muestra la bandeja en lugar de esta
 *  landing. */
@Component({
  selector: 'lib-chat-landing',
  standalone: true,
  imports: [RouterLink, IconComponent, TranslocoPipe],
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto bg-lino-400' },
  templateUrl: './chat-landing.html',
})
export class ChatLandingComponent {
  /** Conversaciones ilustrativas del mockup (datos ficticios, no reales). */
  protected readonly demoChats = [
    { name: 'María González', initials: 'MG', color: 'bg-pink-500', channel: 'whatsapp', last: '¿Tienen la talla M disponible? 🙌', time: '11:52', unread: 2, active: true },
    { name: 'Carlos Rivas', initials: 'CR', color: 'bg-sky-500', channel: 'tiktok', last: 'Perfecto, ya hice el pago ✅', time: '10:04', unread: 0, active: false },
    { name: 'Andrea Pérez', initials: 'AP', color: 'bg-violet-500', channel: 'whatsapp', last: '¿Hacen envíos a Maracaibo?', time: '09:58', unread: 1, active: false },
    { name: 'José Martínez', initials: 'JM', color: 'bg-amber-500', channel: 'whatsapp', last: 'Gracias, quedé encantado 😍', time: '09:41', unread: 0, active: false },
    { name: 'Valentina Ruiz', initials: 'VR', color: 'bg-emerald-500', channel: 'tiktok', last: '¿El precio incluye delivery?', time: '08:47', unread: 0, active: false },
  ];

  /** Mensajes de la conversación abierta en el mockup (ficticios). */
  protected readonly demoMessages = [
    { mine: false, text: 'Hola! Vi el bolso negro en su catálogo 👜' },
    { mine: false, text: '¿Tienen la talla M disponible?' },
    { mine: true, text: '¡Hola María! Sí, nos queda 🙌 ¿Te lo aparto?' },
    { mine: false, text: 'Sí porfa 🙏 ¿Cómo hago el pago?' },
    { mine: true, text: 'Te paso los datos y coordinamos el envío 🚚' },
  ];

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
