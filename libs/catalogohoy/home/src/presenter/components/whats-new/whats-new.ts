import { Component, computed, OnInit, signal } from '@angular/core';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { IconComponent } from '@ui';

interface WhatsNewSection {
  emoji: string | null;
  title: string;
  items: string[];
}

interface WhatsNewIssue {
  id: number;
  title: string;
  sections: WhatsNewSection[];
}

const DISMISS_KEY = 'whats_new_dismissed';
const BLOG_URL = 'https://catalogohoy.com/blog/novedades';
const MAX_ITEMS = 4;

/**
 * "Lo nuevo en CatalogoHoy" en el Inicio: lo principal del último número
 * enviado de la newsletter (RPC newsletter_latest) y enlace a la sección
 * Novedades del blog. Se descarta por número (localStorage): vuelve a salir
 * cuando se envía el siguiente.
 */
@Component({
  selector: 'lib-whats-new',
  standalone: true,
  imports: [IconComponent],
  template: `
    @if (issue(); as i) {
    <div class="relative bg-white border border-slate-200 rounded-xl p-4 shadow-sm -mt-1">
      <button
        type="button"
        (click)="dismiss(i.id)"
        class="absolute top-2 right-2 inline-flex items-center justify-center w-7 h-7 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        aria-label="Descartar"
      >
        <ui-icon name="x" [size]="16" />
      </button>

      <div class="flex items-center gap-3 pr-8">
        <div class="shrink-0 w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center text-lg">✨</div>
        <div class="min-w-0">
          <p class="text-sm font-semibold text-slate-800 leading-tight">Lo nuevo en CatalogoHoy</p>
          <p class="text-xs text-slate-500 mt-0.5 leading-snug truncate">{{ i.title }}</p>
        </div>
      </div>

      <ul class="mt-3 flex flex-col gap-1.5">
        @for (item of highlights(); track item) {
        <li class="text-sm text-slate-700 leading-snug">{{ item }}</li>
        }
      </ul>

      <a
        [href]="blogUrl"
        target="_blank"
        rel="noopener"
        class="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary-500 hover:text-primary-600"
      >
        Ver todas las novedades <ui-icon name="arrow-right" [size]="16" />
      </a>
    </div>
    }
  `,
})
export class WhatsNew implements OnInit {
  private readonly client = SupabaseClientProvider.getInstance();
  public readonly issue = signal<WhatsNewIssue | null>(null);
  public readonly blogUrl = BLOG_URL;

  /** Las primeras novedades de la primera sección ("Nuevas funcionalidades"). */
  public readonly highlights = computed(() => {
    const sections = this.issue()?.sections ?? [];
    return sections.flatMap((s) => s.items ?? []).slice(0, MAX_ITEMS);
  });

  public async ngOnInit(): Promise<void> {
    const { data, error } = await this.client.rpc('newsletter_latest');
    if (error || !data) return;
    const issue = data as WhatsNewIssue;
    if (readDismissed() === String(issue.id)) return;
    if (!issue.sections?.some((s) => s.items?.length)) return;
    this.issue.set(issue);
  }

  public dismiss(id: number): void {
    try {
      localStorage.setItem(DISMISS_KEY, String(id));
    } catch {
      /* sin storage: solo se oculta en esta visita */
    }
    this.issue.set(null);
  }
}

function readDismissed(): string | null {
  try {
    return localStorage.getItem(DISMISS_KEY);
  } catch {
    return null;
  }
}
