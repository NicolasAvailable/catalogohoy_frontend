import { Injectable, isDevMode } from '@angular/core';
import { environment } from '@catalogohoy/env';

@Injectable({ providedIn: 'root' })
export class DiscordWebhookService {
  notifyCheckoutIntent(data: {
    tenantName: string | null;
    tenantSlug: string | null;
    planName: string;
    billingPeriod: string;
  }): void {
    const url = environment.discordCheckoutIntentWebhook;
    if (!url || isDevMode()) return;

    const slug = data.tenantSlug ?? 'desconocido';
    const name = data.tenantName ?? slug;
    const now = new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' });

    const embed = {
      title: '🔥 Checkout Intent',
      color: 0x6366f1,
      fields: [
        { name: 'Negocio', value: name, inline: true },
        { name: 'Slug', value: slug, inline: true },
        { name: 'Plan', value: data.planName, inline: true },
        { name: 'Periodo', value: data.billingPeriod, inline: true },
        { name: 'Fecha', value: now, inline: false },
      ],
    };

    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [embed] }),
    }).catch(() => {});
  }
}
