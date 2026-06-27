import { Component } from '@angular/core';
import { IconComponent } from '@ui';

/** Plantillas de mensajes de WhatsApp (HSM). Placeholder: el alta/gestión vía
 *  Graph API se monta acá (necesario para iniciar conversaciones e/o responder
 *  fuera de la ventana de 24 h, y para el App Review de whatsapp_business_management). */
@Component({
  selector: 'lib-templates',
  standalone: true,
  imports: [IconComponent],
  host: { class: 'flex-1 flex min-h-0' },
  template: `
    <div
      class="flex flex-col items-center justify-center w-full text-center gap-4 p-8"
    >
      <div
        class="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center"
      >
        <ui-icon name="layout-template" size="32" styleClass="text-primary-600" />
      </div>
      <div>
        <h2 class="text-2xl font-bold text-grey-800">Plantillas de mensajes</h2>
        <p class="text-sm text-grey-500 mt-2 max-w-md mx-auto">
          Acá vas a crear y administrar las plantillas de WhatsApp (HSM) para
          iniciar conversaciones o responder fuera de la ventana de 24 horas.
        </p>
      </div>
      <span
        class="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1 rounded-full"
      >
        Próximamente
      </span>
    </div>
  `,
})
export class TemplatesComponent {}
