import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { IconComponent } from '@ui';
import {
  NEWSLETTER_STATUS_LABEL,
  NewsletterIssue,
  NewsletterItem,
  NewsletterKind,
  NewsletterStatus,
} from './newsletter.model';
import { NewsletterService } from './newsletter.service';

const STATUS_TONE: Record<NewsletterStatus, string> = {
  draft: 'bg-amber-50 text-amber-600',
  approved: 'bg-primary-50 text-primary-600',
  sending: 'bg-sky-50 text-sky-600',
  sent: 'bg-emerald-50 text-emerald-600',
  cancelled: 'bg-grey-50 text-grey-400',
};

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Período por defecto: mes anterior (mensual) o lunes→domingo actual (semanal). */
function defaultPeriod(kind: NewsletterKind): { start: string; end: string } {
  const now = new Date();
  if (kind === 'monthly') {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 0));
    return { start: iso(start), end: iso(end) };
  }
  const day = (now.getUTCDay() + 6) % 7; // lunes = 0
  const start = new Date(now);
  start.setUTCDate(now.getUTCDate() - day);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { start: iso(start), end: iso(end) };
}

@Component({
  selector: 'app-newsletter',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-5 h-full min-h-0 overflow-auto pb-2">
      <header class="flex items-start justify-between gap-4 shrink-0">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-bold text-grey-700">Newsletter</h1>
          <p class="text-sm text-grey-400 max-w-2xl">
            Novedades para las tiendas por correo (SES). Mensual el día 1 con
            todo lo del mes y semanal los domingos con lo nuevo y los arreglos.
            Nada sale a clientes hasta que lo apruebes y pulses Enviar.
            Bajas: {{ unsubscribes() }}.
          </p>
        </div>
        <div class="flex gap-2 shrink-0">
          <button type="button" (click)="create('weekly')" class="btn-secondary">
            <ui-icon name="plus" size="14" /> Semanal
          </button>
          <button type="button" (click)="create('monthly')" class="btn-secondary">
            <ui-icon name="plus" size="14" /> Mensual
          </button>
        </div>
      </header>

      @if (error()) {
        <div class="flex items-center gap-2 px-4 py-3 rounded-md bg-red-50 border border-red-100 shrink-0">
          <ui-icon name="circle-alert" size="16" styleClass="text-red-500" />
          <span class="text-sm text-red-600">{{ error() }}</span>
        </div>
      }
      @if (notice()) {
        <div class="flex items-center gap-2 px-4 py-3 rounded-md bg-emerald-50 border border-emerald-100 shrink-0">
          <ui-icon name="circle-check" size="16" styleClass="text-emerald-600" />
          <span class="text-sm text-emerald-700">{{ notice() }}</span>
        </div>
      }

      <div class="grid grid-cols-1 lg:grid-cols-[18rem_1fr] gap-5 min-h-0">
        <!-- Lista de números -->
        <aside class="flex flex-col gap-2">
          @if (isLoading() && !issues().length) {
            @for (s of [1, 2, 3]; track s) {
              <div class="h-16 rounded-lg bg-grey-50 animate-pulse"></div>
            }
          }
          @for (i of issues(); track i.id) {
            <button
              type="button"
              (click)="select(i)"
              class="text-left rounded-lg border p-3 bg-white transition-colors cursor-pointer"
              [class]="draft()?.id === i.id ? 'border-primary-400' : 'border-grey-50 hover:bg-grey-25'"
            >
              <div class="flex items-center justify-between gap-2">
                <span class="text-xs font-semibold text-grey-500">
                  {{ i.kind === 'monthly' ? 'Mensual' : 'Semanal' }} ·
                  {{ i.period_start | date: 'd MMM' }} – {{ i.period_end | date: 'd MMM y' }}
                </span>
                <span class="px-1.5 py-0.5 rounded text-[0.65rem] font-semibold" [class]="tone(i.status)">
                  {{ label(i.status) }}
                </span>
              </div>
              <p class="text-sm text-grey-700 mt-1 line-clamp-2">{{ i.subject }}</p>
              @if (i.sent_count) {
                <p class="text-[0.7rem] text-grey-400 mt-1">
                  {{ i.sent_count }} enviados{{ i.failed_count ? ' · ' + i.failed_count + ' fallidos' : '' }}
                </p>
              }
            </button>
          } @empty {
            @if (!isLoading()) {
              <p class="text-sm text-grey-400">Aún no hay números.</p>
            }
          }
        </aside>

        <!-- Editor + vista previa -->
        @if (draft(); as d) {
          <section class="flex flex-col gap-4 min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="px-2 py-1 rounded-md text-xs font-semibold" [class]="tone(d.status)">
                {{ label(d.status) }}
              </span>
              <div class="flex-1"></div>
              <div class="inline-flex rounded-md border border-grey-50 overflow-hidden">
                <button type="button" (click)="tab.set('edit')" class="px-3 py-1.5 text-sm cursor-pointer"
                  [class]="tab() === 'edit' ? 'bg-primary-400 text-white' : 'bg-white text-grey-500'">Editar</button>
                <button type="button" (click)="showPreview()" [disabled]="!d.id" class="px-3 py-1.5 text-sm cursor-pointer disabled:opacity-50"
                  [class]="tab() === 'preview' ? 'bg-primary-400 text-white' : 'bg-white text-grey-500'">Vista previa</button>
              </div>
            </div>

            @if (tab() === 'edit') {
              <fieldset [disabled]="!editable()" class="flex flex-col gap-3 bg-white rounded-xl border border-grey-50 p-4 disabled:opacity-70">
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <label class="field">
                    <span>Tipo</span>
                    <select [(ngModel)]="d.kind">
                      <option value="monthly">Mensual</option>
                      <option value="weekly">Semanal</option>
                    </select>
                  </label>
                  <label class="field"><span>Desde</span><input type="date" [(ngModel)]="d.period_start" /></label>
                  <label class="field"><span>Hasta</span><input type="date" [(ngModel)]="d.period_end" /></label>
                </div>
                <label class="field"><span>Asunto del correo</span><input [(ngModel)]="d.subject" /></label>
                <label class="field"><span>Título</span><input [(ngModel)]="d.title" /></label>
                <label class="field"><span>Introducción</span><textarea rows="3" [(ngModel)]="d.intro"></textarea></label>

                @for (s of d.sections; track $index; let si = $index) {
                  <div class="rounded-lg border border-grey-50 p-3 flex flex-col gap-2">
                    <div class="flex gap-2 items-end">
                      <label class="field w-16"><span>Emoji</span><input [(ngModel)]="s.emoji" /></label>
                      <label class="field flex-1"><span>Sección</span><input [(ngModel)]="s.title" /></label>
                      <button type="button" (click)="moveSection(si, -1)" class="icon-btn" aria-label="Subir"><ui-icon name="arrow-up" size="14" /></button>
                      <button type="button" (click)="moveSection(si, 1)" class="icon-btn" aria-label="Bajar"><ui-icon name="arrow-down" size="14" /></button>
                      <button type="button" (click)="d.sections.splice(si, 1)" class="icon-btn" aria-label="Quitar sección"><ui-icon name="trash-2" size="14" /></button>
                    </div>
                    @for (it of s.items; track $index; let ii = $index) {
                      <div class="flex gap-2 items-start pl-2 border-l-2 border-grey-50">
                        <div class="flex-1 flex flex-col gap-1">
                          <input class="font-semibold" placeholder="Título" [(ngModel)]="it.title" />
                          <textarea rows="2" placeholder="Texto corto (vacío = línea de la lista de ajustes)" [(ngModel)]="it.text"></textarea>
                          <div class="flex gap-2 items-center">
                            <input placeholder="Imagen (URL https, opcional)" [(ngModel)]="it.image" />
                            <label class="btn-secondary shrink-0" [class.opacity-50]="uploading()">
                              <ui-icon name="image" size="14" /> Subir
                              <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" (change)="upload($event, it)" />
                            </label>
                          </div>
                          @if (it.image) {
                            <img [src]="it.image" alt="" class="max-h-32 w-auto self-start rounded-md border border-grey-50" />
                          }
                        </div>
                        <button type="button" (click)="s.items.splice(ii, 1)" class="icon-btn" aria-label="Quitar"><ui-icon name="x" size="14" /></button>
                      </div>
                    }
                    <button type="button" (click)="s.items.push({ title: '', text: '' })" class="self-start text-xs text-primary-500 cursor-pointer">
                      + Agregar novedad
                    </button>
                  </div>
                }
                <button type="button" (click)="d.sections.push({ emoji: '✨', title: '', items: [{ title: '', text: '' }] })" class="self-start text-sm text-primary-500 cursor-pointer">
                  + Agregar sección
                </button>
                <label class="field"><span>Cierre</span><textarea rows="2" [(ngModel)]="d.outro"></textarea></label>
              </fieldset>
            } @else {
              <div class="rounded-xl border border-grey-50 overflow-hidden bg-white">
                @if (previewLoading()) {
                  <div class="h-[70vh] bg-grey-50 animate-pulse"></div>
                } @else {
                  <iframe title="Vista previa" class="w-full h-[70vh] border-0" [srcdoc]="preview()"></iframe>
                }
              </div>
            }

            <!-- Acciones -->
            <div class="flex flex-wrap items-center gap-2">
              @if (editable()) {
                <button type="button" (click)="save()" [disabled]="busy()" class="btn-secondary">
                  <ui-icon name="save" size="14" /> Guardar
                </button>
              }
              @if (d.id) {
                <input class="w-56" type="email" placeholder="Correo de prueba (opcional)" [(ngModel)]="testEmail" />
                <button type="button" (click)="sendTest()" [disabled]="busy()" class="btn-secondary">
                  <ui-icon name="send" size="14" /> Enviar prueba
                </button>
              }
              <div class="flex-1"></div>
              @if (d.id && d.status === 'draft') {
                <button type="button" (click)="setStatus('approved')" [disabled]="busy()" class="btn-primary">
                  <ui-icon name="circle-check" size="14" /> Aprobar
                </button>
              }
              @if (d.id && d.status === 'approved') {
                <button type="button" (click)="setStatus('draft')" [disabled]="busy()" class="btn-secondary">Volver a borrador</button>
              }
              @if (d.id && (d.status === 'approved' || d.status === 'sending')) {
                @if (!confirming()) {
                  <button type="button" (click)="askSend()" [disabled]="busy()" class="btn-primary">
                    <ui-icon name="mail" size="14" /> Enviar a las tiendas
                  </button>
                } @else {
                  <span class="text-sm text-grey-600">Se enviará a {{ audienceCount() ?? '…' }} correos.</span>
                  <button type="button" (click)="confirming.set(false)" class="btn-secondary">Cancelar</button>
                  <button type="button" (click)="sendAll()" [disabled]="busy() || audienceCount() === null" class="btn-primary">Confirmar envío</button>
                }
              }
            </div>
            @if (progress()) {
              <p class="text-sm text-grey-500">{{ progress() }}</p>
            }
          </section>
        }
      </div>
    </div>
  `,
  styles: `
    .field { display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.75rem; color: var(--color-grey-400); }
    input, select, textarea {
      width: 100%; border: 1px solid var(--color-grey-50); border-radius: 0.375rem;
      padding: 0.45rem 0.6rem; font-size: 0.875rem; color: var(--color-grey-700); background: var(--color-white, #fff);
    }
    .btn-primary, .btn-secondary {
      display: inline-flex; align-items: center; gap: 0.375rem; padding: 0.45rem 0.85rem;
      border-radius: 0.375rem; font-size: 0.875rem; font-weight: 600; cursor: pointer;
    }
    .btn-primary { background: var(--color-primary-400); color: #fff; }
    .btn-secondary { background: var(--color-white, #fff); border: 1px solid var(--color-grey-50); color: var(--color-grey-600); }
    button:disabled { opacity: 0.5; cursor: default; }
    .icon-btn { padding: 0.45rem; border-radius: 0.375rem; color: var(--color-grey-400); cursor: pointer; }
    .icon-btn:hover { background: var(--color-grey-50); }
  `,
})
export class Newsletter implements OnInit {
  private readonly service = inject(NewsletterService);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly issues = signal<NewsletterIssue[]>([]);
  protected readonly unsubscribes = signal(0);
  protected readonly draft = signal<NewsletterIssue | null>(null);
  protected readonly tab = signal<'edit' | 'preview'>('edit');
  protected readonly preview = signal<SafeHtml>('');
  protected readonly previewLoading = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly busy = signal(false);
  protected readonly uploading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly notice = signal<string | null>(null);
  protected readonly progress = signal<string | null>(null);
  protected readonly confirming = signal(false);
  protected readonly audienceCount = signal<number | null>(null);
  protected testEmail = '';

  protected readonly editable = computed(() => {
    const s = this.draft()?.status;
    return !s || s === 'draft' || s === 'approved';
  });

  ngOnInit(): void {
    this.load();
  }

  protected label(s: NewsletterStatus): string {
    return NEWSLETTER_STATUS_LABEL[s] ?? s;
  }

  protected tone(s: NewsletterStatus): string {
    return STATUS_TONE[s] ?? '';
  }

  async load(keepId?: number | null): Promise<void> {
    this.isLoading.set(true);
    const res = await this.service.list();
    res.mapRight((l) => {
      this.issues.set(l.issues ?? []);
      this.unsubscribes.set(l.unsubscribes ?? 0);
      const id = keepId ?? this.draft()?.id;
      const found = l.issues.find((i) => i.id === id) ?? l.issues[0];
      if (found) this.select(found);
    });
    res.mapLeft((e) => this.error.set(e.message));
    this.isLoading.set(false);
  }

  protected select(i: NewsletterIssue): void {
    // Copia profunda para editar sin tocar la lista.
    this.draft.set(JSON.parse(JSON.stringify(i)));
    this.tab.set('edit');
    this.confirming.set(false);
    this.progress.set(null);
  }

  protected create(kind: NewsletterKind): void {
    const p = defaultPeriod(kind);
    this.draft.set({
      id: null,
      kind,
      period_start: p.start,
      period_end: p.end,
      subject: kind === 'monthly' ? 'Novedades del mes en CatalogoHoy' : 'Lo nuevo de esta semana en CatalogoHoy',
      title: kind === 'monthly' ? 'Lo nuevo en CatalogoHoy' : 'Esta semana en CatalogoHoy',
      intro: '',
      sections: [
        { emoji: '🚀', title: 'Nuevas funcionalidades', items: [{ title: '', text: '' }] },
        { emoji: '🔧', title: 'Ajustes y mejoras', items: [{ title: '', text: '' }] },
      ],
      outro: '¿Tienes una idea o algo que te gustaría ver? Responde este correo.',
      status: 'draft',
    });
    this.tab.set('edit');
  }

  protected moveSection(i: number, delta: number): void {
    const d = this.draft();
    if (!d) return;
    const j = i + delta;
    if (j < 0 || j >= d.sections.length) return;
    [d.sections[i], d.sections[j]] = [d.sections[j], d.sections[i]];
  }

  protected async upload(ev: Event, item: NewsletterItem): Promise<void> {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.uploading.set(true);
    const res = await this.service.uploadImage(file);
    res.mapRight((url) => (item.image = url));
    res.mapLeft((e) => this.error.set(e.message));
    this.uploading.set(false);
  }

  private clean(d: NewsletterIssue): NewsletterIssue {
    return {
      ...d,
      sections: d.sections
        .map((s) => ({
          ...s,
          items: s.items
            .filter((it) => it.title.trim() || it.text.trim())
            .map((it) => (it.image?.trim() ? it : { title: it.title, text: it.text })),
        }))
        .filter((s) => s.title.trim() && s.items.length),
    };
  }

  private flash(msg: string): void {
    this.error.set(null);
    this.notice.set(msg);
    setTimeout(() => this.notice.set(null), 4000);
  }

  async save(): Promise<number | null> {
    const d = this.draft();
    if (!d) return null;
    this.busy.set(true);
    const res = await this.service.save(this.clean(d));
    let id: number | null = null;
    res.mapRight((newId) => (id = newId));
    res.mapLeft((e) => this.error.set(e.message));
    this.busy.set(false);
    if (id !== null) {
      this.flash('Guardado.');
      await this.load(id);
    }
    return id;
  }

  async showPreview(): Promise<void> {
    const d = this.draft();
    if (!d?.id) return;
    this.tab.set('preview');
    this.previewLoading.set(true);
    const res = await this.service.preview(d.id);
    res.mapRight((p) =>
      this.preview.set(this.sanitizer.bypassSecurityTrustHtml(p.html))
    );
    res.mapLeft((e) => this.error.set(e.message));
    this.previewLoading.set(false);
  }

  async sendTest(): Promise<void> {
    const d = this.draft();
    if (!d?.id) return;
    this.busy.set(true);
    const res = await this.service.test(d.id, this.testEmail.trim() || undefined);
    res.mapRight((r) => this.flash(`Prueba enviada a ${r.to}.`));
    res.mapLeft((e) => this.error.set(e.message));
    this.busy.set(false);
  }

  async setStatus(status: NewsletterStatus): Promise<void> {
    const d = this.draft();
    if (!d?.id) return;
    this.busy.set(true);
    const res = await this.service.setStatus(d.id, status);
    res.mapLeft((e) => this.error.set(e.message));
    this.busy.set(false);
    await this.load(d.id);
  }

  async askSend(): Promise<void> {
    const d = this.draft();
    if (!d?.id) return;
    this.confirming.set(true);
    this.audienceCount.set(null);
    const res = await this.service.audience(d.id);
    res.mapRight((a) => this.audienceCount.set(a.remaining));
    res.mapLeft((e) => this.error.set(e.message));
  }

  async sendAll(): Promise<void> {
    const d = this.draft();
    if (!d?.id) return;
    this.busy.set(true);
    this.confirming.set(false);
    let sent = 0;
    let failed = 0;
    for (let round = 0; round < 50; round++) {
      const res = await this.service.send(d.id);
      if (res.isLeft()) {
        this.error.set(res.value.message);
        break;
      }
      const r = res.value;
      sent += r.sent;
      failed += r.failed;
      this.progress.set(`Enviados ${sent}${failed ? ` · ${failed} fallidos` : ''} · faltan ${r.remaining}`);
      if (r.remaining === 0 || r.sent + r.failed === 0) break;
    }
    this.busy.set(false);
    await this.load(d.id);
  }
}
