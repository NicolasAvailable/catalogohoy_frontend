import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, IconComponent } from '@ui';

/** Base pública de la edge `public-api` (dominio propio de Supabase). */
const API_BASE = 'https://api.catalogohoy.com/functions/v1/public-api';

type Access = 'none' | 'read' | 'write';

interface Area {
  key: 'products' | 'orders' | 'customers' | 'settings' | 'expenses';
  label: string;
  hint: string;
  canWrite: boolean;
}

const AREAS: Area[] = [
  { key: 'products', label: 'Productos y categorías', hint: 'Crear, editar, precios, stock, fotos', canWrite: true },
  { key: 'orders', label: 'Órdenes y métricas', hint: 'Crear, editar y cambiar estado de órdenes', canWrite: true },
  { key: 'customers', label: 'Clientes', hint: 'Solo lectura', canWrite: false },
  { key: 'settings', label: 'Configuración de la tienda', hint: 'Horario, pagos, envíos, tasa de cambio', canWrite: true },
  { key: 'expenses', label: 'Gastos y facturas', hint: 'Registrar y editar gastos', canWrite: true },
];

interface ApiToken {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  created_by_email: string | null;
}

interface ApiLogRow {
  id: number;
  token_name: string | null;
  method: string | null;
  tool: string | null;
  status: number;
  error: string | null;
  duration_ms: number | null;
  created_at: string;
}

/**
 * Perfil → pestaña "API": el dueño/admin crea tokens para que software externo (p. ej.
 * agentes de IA de Work by Agents) gestione SU tienda vía la edge `public-api`.
 * El token se muestra una sola vez (en la DB queda solo el hash). Las RPCs
 * `api_*` validan owner/admin; ver migración 20261105_public_api_tokens.sql.
 */
@Component({
  selector: 'lib-api-access',
  imports: [DatePipe, FormsModule, TranslocoPipe, ButtonComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4 sm:gap-6">
      <header class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h2 class="text-2xl font-bold text-grey-800 mb-1">{{ 'API y agentes de IA' | transloco }}</h2>
          <p class="text-sm sm:text-base text-grey-400">
            {{ 'Conecta otros programas o asistentes de IA para que gestionen tu tienda con un token de acceso.' | transloco }}
          </p>
        </div>
        @if (!forbidden() && !showForm()) {
          <ui-button label="Crear token" icon="plus" size="small" [fluid]="false" (click)="openForm()" />
        }
      </header>

      @if (forbidden()) {
        <div class="bg-white border border-grey-100 rounded-xl p-6 text-grey-600">
          {{ 'Solo el dueño o un administrador de la tienda puede gestionar la API.' | transloco }}
        </div>
      } @else {
        <!-- Token recién creado -->
        @if (newToken(); as tok) {
          <div class="border border-amber-300 bg-amber-50 rounded-xl p-4 flex flex-col gap-3" data-testid="api-new-token">
            <div class="flex items-center gap-2 font-semibold text-amber-800">
              <ui-icon name="key-round" styleClass="size-4" />
              {{ 'Copia tu token ahora. No lo volverás a ver.' | transloco }}
            </div>
            <div class="flex flex-col sm:flex-row gap-2">
              <code class="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm break-all text-grey-800">{{ tok }}</code>
              <ui-button label="Copiar" icon="copy" size="small" [fluid]="false" (click)="copy(tok)" />
            </div>
            <p class="text-xs text-amber-800">
              {{ 'Pégalo en el programa que vas a conectar. Si lo pierdes, revócalo y crea otro.' | transloco }}
            </p>
            <button type="button" class="self-start text-sm font-semibold text-amber-800 hover:underline cursor-pointer" (click)="newToken.set(null)">
              {{ 'Ya lo guardé' | transloco }}
            </button>
          </div>
        }

        <!-- Formulario -->
        @if (showForm()) {
          <div class="bg-white border border-grey-100 rounded-xl shadow-sm p-4 sm:p-6 flex flex-col gap-4">
            <h2 class="text-lg font-semibold text-grey-800">{{ 'Nuevo token' | transloco }}</h2>
            <label class="flex flex-col gap-1">
              <span class="text-sm font-semibold text-grey-700">{{ 'Nombre' | transloco }}</span>
              <input
                type="text"
                maxlength="60"
                class="border border-grey-200 rounded-lg px-3 py-2 text-sm bg-white text-grey-800"
                [placeholder]="'Ej. Work by Agents' | transloco"
                [ngModel]="name()"
                (ngModelChange)="name.set($event)"
              />
            </label>

            <div class="flex flex-col gap-2">
              <span class="text-sm font-semibold text-grey-700">{{ 'Qué puede hacer' | transloco }}</span>
              @for (area of areas; track area.key) {
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border border-grey-100 rounded-lg px-3 py-2">
                  <div>
                    <div class="text-sm font-semibold text-grey-800">{{ area.label | transloco }}</div>
                    <div class="text-xs text-grey-400">{{ area.hint | transloco }}</div>
                  </div>
                  <select
                    class="border border-grey-200 rounded-lg px-2 py-1.5 text-sm bg-white text-grey-800"
                    [ngModel]="access()[area.key]"
                    (ngModelChange)="setAccess(area.key, $event)"
                  >
                    <option value="none">{{ 'Sin acceso' | transloco }}</option>
                    <option value="read">{{ 'Ver' | transloco }}</option>
                    @if (area.canWrite) {
                      <option value="write">{{ 'Ver y editar' | transloco }}</option>
                    }
                  </select>
                </div>
              }
            </div>

            <label class="flex flex-col gap-1 sm:max-w-xs">
              <span class="text-sm font-semibold text-grey-700">{{ 'Vence' | transloco }}</span>
              <select
                class="border border-grey-200 rounded-lg px-2 py-2 text-sm bg-white text-grey-800"
                [ngModel]="expiresDays()"
                (ngModelChange)="expiresDays.set(+$event)"
              >
                <option [value]="0">{{ 'Nunca' | transloco }}</option>
                <option [value]="30">{{ 'En 30 días' | transloco }}</option>
                <option [value]="90">{{ 'En 90 días' | transloco }}</option>
                <option [value]="365">{{ 'En 1 año' | transloco }}</option>
              </select>
            </label>

            <div class="flex gap-2">
              <ui-button label="Crear token" size="small" [fluid]="false" [isLoading]="saving()" [disabled]="!canCreate()" (click)="create()" />
              <ui-button label="Cancelar" variant="text" size="small" [fluid]="false" (click)="showForm.set(false)" />
            </div>
          </div>
        }

        <!-- Cómo conectar -->
        <div class="bg-white border border-grey-100 rounded-xl shadow-sm p-4 sm:p-6 flex flex-col gap-3">
          <h2 class="text-lg font-semibold text-grey-800">{{ 'Cómo conectar' | transloco }}</h2>
          <div class="flex flex-col gap-1">
            <span class="text-xs font-semibold uppercase text-grey-400">{{ 'Agentes de IA (MCP)' | transloco }}</span>
            <div class="flex items-center gap-2">
              <code class="flex-1 bg-grey-25 border border-grey-100 rounded-lg px-3 py-2 text-sm break-all text-grey-800">{{ mcpUrl }}</code>
              <button type="button" class="p-2 rounded-lg hover:bg-grey-25 cursor-pointer" [title]="'Copiar' | transloco" (click)="copy(mcpUrl)">
                <ui-icon name="copy" styleClass="size-4 text-grey-600" />
              </button>
            </div>
          </div>
          <div class="flex flex-col gap-1">
            <span class="text-xs font-semibold uppercase text-grey-400">{{ 'API REST' | transloco }}</span>
            <div class="flex items-center gap-2">
              <code class="flex-1 bg-grey-25 border border-grey-100 rounded-lg px-3 py-2 text-sm break-all text-grey-800">{{ apiBase }}/v1</code>
              <button type="button" class="p-2 rounded-lg hover:bg-grey-25 cursor-pointer" [title]="'Copiar' | transloco" (click)="copy(apiBase + '/v1')">
                <ui-icon name="copy" styleClass="size-4 text-grey-600" />
              </button>
            </div>
          </div>
          <p class="text-sm text-grey-500">
            {{ 'El token va en el header' | transloco }} <code class="text-grey-700">Authorization: Bearer cht_…</code>.
            <a [href]="docsUrl" target="_blank" rel="noopener" class="font-semibold text-primary-600 hover:underline">{{ 'Ver documentación' | transloco }}</a>
          </p>
        </div>

        <!-- Tokens -->
        <div class="bg-white border border-grey-100 rounded-xl shadow-sm p-4 sm:p-6 flex flex-col gap-3">
          <h2 class="text-lg font-semibold text-grey-800">{{ 'Tokens' | transloco }}</h2>
          @if (loading()) {
            <p class="text-sm text-grey-400">{{ 'Cargando…' | transloco }}</p>
          } @else if (!tokens().length) {
            <p class="text-sm text-grey-400">{{ 'Todavía no has creado ningún token.' | transloco }}</p>
          } @else {
            <div class="flex flex-col divide-y divide-grey-100" data-testid="api-tokens">
              @for (t of tokens(); track t.id) {
                <div class="py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4" [class.opacity-50]="!isActive(t)">
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="font-semibold text-grey-800 truncate">{{ t.name }}</span>
                      <code class="text-xs text-grey-400">{{ t.prefix }}…</code>
                      @if (t.revoked_at) {
                        <span class="px-1.5 py-0.5 rounded-md bg-red-50 text-red-600 text-[10px] font-semibold">{{ 'Revocado' | transloco }}</span>
                      } @else if (isExpired(t)) {
                        <span class="px-1.5 py-0.5 rounded-md bg-grey-50 text-grey-500 text-[10px] font-semibold">{{ 'Vencido' | transloco }}</span>
                      }
                    </div>
                    <div class="text-xs text-grey-400 mt-0.5">{{ scopeSummary(t.scopes) }}</div>
                    <div class="text-xs text-grey-400">
                      {{ 'Creado' | transloco }} {{ t.created_at | date: 'dd/MM/yyyy' }}
                      · {{ 'Último uso' | transloco }}: {{ t.last_used_at ? (t.last_used_at | date: 'dd/MM/yyyy HH:mm') : ('nunca' | transloco) }}
                      @if (t.expires_at) {
                        · {{ 'Vence' | transloco }} {{ t.expires_at | date: 'dd/MM/yyyy' }}
                      }
                    </div>
                  </div>
                  @if (isActive(t)) {
                    @if (confirmRevoke() === t.id) {
                      <div class="flex gap-2">
                        <ui-button label="Sí, revocar" severity="danger" size="small" [fluid]="false" (click)="revoke(t.id)" />
                        <ui-button label="No" variant="text" size="small" [fluid]="false" (click)="confirmRevoke.set(null)" />
                      </div>
                    } @else {
                      <ui-button label="Revocar" variant="outlined" severity="danger" size="small" [fluid]="false" (click)="confirmRevoke.set(t.id)" />
                    }
                  }
                </div>
              }
            </div>
          }
        </div>

        <!-- Actividad -->
        <div class="bg-white border border-grey-100 rounded-xl shadow-sm p-4 sm:p-6 flex flex-col gap-3">
          <h2 class="text-lg font-semibold text-grey-800">{{ 'Actividad reciente' | transloco }}</h2>
          @if (!logs().length) {
            <p class="text-sm text-grey-400">{{ 'Aún no hay llamadas a la API.' | transloco }}</p>
          } @else {
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-grey-400">
                    <th class="py-1 pr-3 font-semibold">{{ 'Fecha' | transloco }}</th>
                    <th class="py-1 pr-3 font-semibold">{{ 'Token' | transloco }}</th>
                    <th class="py-1 pr-3 font-semibold">{{ 'Acción' | transloco }}</th>
                    <th class="py-1 pr-3 font-semibold">{{ 'Resultado' | transloco }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (l of logs(); track l.id) {
                    <tr class="border-t border-grey-100">
                      <td class="py-1.5 pr-3 whitespace-nowrap text-grey-500">{{ l.created_at | date: 'dd/MM HH:mm:ss' }}</td>
                      <td class="py-1.5 pr-3 text-grey-700">{{ l.token_name ?? '—' }}</td>
                      <td class="py-1.5 pr-3"><code class="text-grey-700">{{ l.tool ?? l.method }}</code></td>
                      <td class="py-1.5 pr-3" [class.text-green-600]="l.status < 400" [class.text-red-600]="l.status >= 400" [title]="l.error ?? ''">
                        {{ l.status < 400 ? ('OK' | transloco) : l.status + (l.error ? ' · ' + l.error : '') }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class ApiAccessComponent implements OnInit {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly toast = inject(ToastService);

  public readonly areas = AREAS;
  public readonly apiBase = API_BASE;
  public readonly mcpUrl = `${API_BASE}/mcp`;
  public readonly docsUrl = `${API_BASE}/docs`;

  public readonly loading = signal(true);
  public readonly forbidden = signal(false);
  public readonly saving = signal(false);
  public readonly tokens = signal<ApiToken[]>([]);
  public readonly logs = signal<ApiLogRow[]>([]);
  public readonly showForm = signal(false);
  public readonly newToken = signal<string | null>(null);
  public readonly confirmRevoke = signal<string | null>(null);

  public readonly name = signal('');
  public readonly expiresDays = signal(0);
  public readonly access = signal<Record<Area['key'], Access>>(this.defaultAccess());

  public readonly scopes = computed(() =>
    Object.entries(this.access()).flatMap(([key, a]) =>
      a === 'write' ? [`${key}:read`, `${key}:write`] : a === 'read' ? [`${key}:read`] : []
    )
  );
  public readonly canCreate = computed(() => !!this.name().trim() && this.scopes().length > 0 && !this.saving());

  private tenantId: number | null = null;

  async ngOnInit(): Promise<void> {
    this.tenantId = await this.tenantStore.getTenantIdAsync();
    await this.load();
  }

  private defaultAccess(): Record<Area['key'], Access> {
    return { products: 'write', orders: 'write', customers: 'read', settings: 'read', expenses: 'none' };
  }

  private async load(): Promise<void> {
    if (!this.tenantId) return;
    this.loading.set(true);
    const [tokens, logs] = await Promise.all([
      this.client.rpc('api_tokens_list', { p_tenant_id: this.tenantId }),
      this.client.rpc('api_request_log_list', { p_tenant_id: this.tenantId, p_limit: 50 }),
    ]);
    this.loading.set(false);
    if (tokens.error) {
      if (tokens.error.message.includes('forbidden')) this.forbidden.set(true);
      else this.toast.error(new Exception('No pudimos cargar los tokens.'));
      return;
    }
    this.tokens.set((tokens.data as ApiToken[]) ?? []);
    this.logs.set((logs.data as ApiLogRow[]) ?? []);
  }

  public openForm(): void {
    this.name.set('');
    this.expiresDays.set(0);
    this.access.set(this.defaultAccess());
    this.showForm.set(true);
  }

  public setAccess(key: Area['key'], value: Access): void {
    this.access.update((a) => ({ ...a, [key]: value }));
  }

  public async create(): Promise<void> {
    if (!this.tenantId || !this.canCreate()) return;
    this.saving.set(true);
    const { data, error } = await this.client.rpc('api_token_create', {
      p_tenant_id: this.tenantId,
      p_name: this.name().trim(),
      p_scopes: this.scopes(),
      p_expires_days: this.expiresDays(),
    });
    this.saving.set(false);
    if (error) {
      const msg = error.message.includes('too_many_tokens')
        ? 'Máximo 10 tokens activos. Revoca uno antes de crear otro.'
        : 'No pudimos crear el token.';
      this.toast.error(new Exception(msg));
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    this.newToken.set(row?.token ?? null);
    this.showForm.set(false);
    await this.load();
  }

  public async revoke(id: string): Promise<void> {
    const { error } = await this.client.rpc('api_token_revoke', { p_token_id: id });
    this.confirmRevoke.set(null);
    if (error) {
      this.toast.error(new Exception('No pudimos revocar el token.'));
      return;
    }
    this.toast.success('Token revocado. Ya no funciona.');
    await this.load();
  }

  public async copy(text: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      this.toast.success('Copiado');
    } catch {
      this.toast.warning('No se pudo copiar. Selecciónalo y cópialo a mano.');
    }
  }

  public isExpired(t: ApiToken): boolean {
    return !!t.expires_at && new Date(t.expires_at).getTime() < Date.now();
  }

  public isActive(t: ApiToken): boolean {
    return !t.revoked_at && !this.isExpired(t);
  }

  public scopeSummary(scopes: string[]): string {
    return AREAS.map((a) => {
      if (scopes.includes(`${a.key}:write`)) return `${a.label}: ver y editar`;
      if (scopes.includes(`${a.key}:read`)) return `${a.label}: ver`;
      return null;
    })
      .filter(Boolean)
      .join(' · ');
  }
}
