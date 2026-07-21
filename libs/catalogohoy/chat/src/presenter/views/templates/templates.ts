import { NgClass } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  ConfirmDialogService,
  IconComponent,
  InputTextComponent,
  SelectComponent,
  SkeletonDirective,
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
    SkeletonDirective,
    TextareaComponent,
    TranslocoPipe,
  ],
  host: { class: 'flex-1 flex flex-col min-h-0 overflow-y-auto' },
  templateUrl: './templates.html',
})
export class TemplatesComponent implements OnInit {
  /** Ejemplo de variable para el hint (evita escapar llaves en el template). */
  protected readonly varExample = '{{1}}';

  private readonly service = inject(TemplatesService);
  private readonly toast = inject(ToastService);
  private readonly confirmDialog = inject(ConfirmDialogService);

  protected readonly templates = signal<WhatsAppTemplate[]>([]);
  protected readonly loading = signal(false);
  protected readonly creating = signal(false);
  protected readonly showForm = signal(false);
  /** Nombre de la plantilla que se está eliminando (spinner por card). */
  protected readonly deletingName = signal<string | null>(null);

  // Formulario de creación.
  protected readonly fName = signal('');
  protected readonly fCategory = signal('UTILITY');
  protected readonly fLanguage = signal('es');
  protected readonly fBody = signal('');
  /** Ejemplo por número de variable ({{1}} → fExamples()[1]). */
  protected readonly fExamples = signal<Record<number, string>>({});

  /** Variables {{n}} únicas del cuerpo, ordenadas. Meta exige un ejemplo por
   *  cada una para aprobar la plantilla. */
  protected readonly bodyVars = computed(() => {
    const found = [...this.fBody().matchAll(/\{\{(\d+)\}\}/g)].map((m) =>
      Number(m[1])
    );
    return [...new Set(found)].sort((a, b) => a - b);
  });

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
    this.fExamples.set({});
    this.showForm.set(true);
  }

  setExample(varNumber: number, value: string): void {
    this.fExamples.set({ ...this.fExamples(), [varNumber]: value });
  }

  /** "{{n}}" para el label del input (las llaves literales rompen el parser
   *  del template — mismo truco que varExample). */
  varToken(varNumber: number): string {
    return `{{${varNumber}}}`;
  }

  exampleOf(varNumber: number): string {
    return this.fExamples()[varNumber] ?? '';
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

    // Variables: deben ser {{1}}, {{2}}… consecutivas y con ejemplo (Meta
    // rechaza la creación si falta cualquiera de las dos cosas).
    const vars = this.bodyVars();
    let examples: string[] | undefined;
    if (vars.length) {
      const isSequential = vars.every((v, i) => v === i + 1);
      if (!isSequential) {
        this.toast.warning('Las variables deben empezar en {{1}} y ser consecutivas.');
        return;
      }
      examples = vars.map((v) => (this.fExamples()[v] ?? '').trim());
      if (examples.some((e) => !e)) {
        this.toast.warning('Completá un ejemplo para cada variable.');
        return;
      }
    }

    this.creating.set(true);
    const res = await this.service.create({
      name,
      category: this.fCategory(),
      language: this.fLanguage(),
      body,
      examples,
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

  deleteTemplate(t: WhatsAppTemplate): void {
    this.confirmDialog
      .warning({
        headerLabel: '¿Eliminar plantilla?',
        target: t.name,
        contentLabel:
          'La plantilla se eliminará de Meta en todos sus idiomas. Esta acción no se puede deshacer.',
        acceptLabel: 'Eliminar',
      })
      .subscribe((result) => {
        result.mapRight(async () => {
          this.deletingName.set(t.name);
          const res = await this.service.delete(t.name);
          this.deletingName.set(null);
          if (res.isRight()) {
            this.toast.success('Plantilla eliminada.');
            this.load();
          } else {
            this.toast.warning(res.value.message);
          }
        });
      });
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
