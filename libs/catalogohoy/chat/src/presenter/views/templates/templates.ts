import { NgClass } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  IconComponent,
  InputTextComponent,
  SelectComponent,
  TextareaComponent,
} from '@ui';
import {
  TemplatesService,
  WhatsAppTemplate,
} from '../../../infrastructure/templates.service';

/** Plantillas de mensajes de WhatsApp (HSM): listar las de la WABA y crear nuevas
 *  (para iniciar conversaciones / responder fuera de la ventana de 24h y para el
 *  App Review de whatsapp_business_management). Vista en ./templates.html. */
@Component({
  selector: 'lib-templates',
  standalone: true,
  imports: [
    FormsModule,
    NgClass,
    IconComponent,
    ButtonComponent,
    InputTextComponent,
    SelectComponent,
    TextareaComponent,
  ],
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto' },
  templateUrl: './templates.html',
})
export class TemplatesComponent implements OnInit {
  /** Ejemplo de variable para el hint (evita escapar llaves en el template). */
  protected readonly varExample = '{{1}}';

  private readonly service = inject(TemplatesService);
  private readonly toast = inject(ToastService);

  protected readonly templates = signal<WhatsAppTemplate[]>([]);
  protected readonly loading = signal(false);
  protected readonly creating = signal(false);
  protected readonly showForm = signal(false);

  // Formulario de creación.
  protected readonly fName = signal('');
  protected readonly fCategory = signal('UTILITY');
  protected readonly fLanguage = signal('es');
  protected readonly fBody = signal('');

  protected readonly categories = [
    { label: 'Utilidad', value: 'UTILITY' },
    { label: 'Marketing', value: 'MARKETING' },
    { label: 'Autenticación', value: 'AUTHENTICATION' },
  ];
  protected readonly languages = [
    { label: 'Español', value: 'es' },
    { label: 'Español (México)', value: 'es_MX' },
    { label: 'Español (Argentina)', value: 'es_AR' },
    { label: 'Inglés (EE. UU.)', value: 'en_US' },
    { label: 'Portugués (Brasil)', value: 'pt_BR' },
  ];

  ngOnInit(): void {
    this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    const res = await this.service.list();
    this.loading.set(false);
    if (res.isRight()) this.templates.set(res.value);
    else this.toast.warning(res.value.message);
  }

  openForm(): void {
    this.fName.set('');
    this.fCategory.set('UTILITY');
    this.fLanguage.set('es');
    this.fBody.set('');
    this.showForm.set(true);
  }

  /** Meta exige el nombre en minúsculas con letras/números/guion bajo. */
  protected normalizedName(): string {
    return this.fName()
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '');
  }

  async create(): Promise<void> {
    const name = this.normalizedName();
    const body = this.fBody().trim();
    if (!name || !body) {
      this.toast.warning('El nombre y el cuerpo son obligatorios.');
      return;
    }
    this.creating.set(true);
    const res = await this.service.create({
      name,
      category: this.fCategory(),
      language: this.fLanguage(),
      body,
    });
    this.creating.set(false);
    if (res.isRight()) {
      this.toast.success('Plantilla enviada a revisión de Meta.');
      this.showForm.set(false);
      this.load();
    } else {
      this.toast.warning(res.value.message);
    }
  }

  bodyOf(t: WhatsAppTemplate): string {
    return t.components?.find((c) => c.type === 'BODY')?.text ?? '';
  }

  statusClass(status: string): string {
    const s = (status || '').toUpperCase();
    if (s === 'APPROVED') return 'bg-primary-50 text-primary-700';
    if (s === 'REJECTED' || s === 'DISABLED') return 'bg-red-50 text-red-600';
    return 'bg-amber-50 text-amber-700';
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      APPROVED: 'Aprobada',
      PENDING: 'En revisión',
      REJECTED: 'Rechazada',
      DISABLED: 'Deshabilitada',
    };
    return map[(status || '').toUpperCase()] ?? status;
  }
}
