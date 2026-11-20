import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { SupabaseClientProvider } from '@catalogohoy/core';
import { TenantStore } from '@catalogohoy/tenant';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, IconComponent, ToggleComponent } from '@ui';

/** WhatsApp de soporte (+58 422-0240947) para comprar el complemento. */
const SUPPORT_WA = '584220240947';

interface ReminderStatus {
  addon_active: boolean;
  active_until: string | null;
  billing: string | null;
  enabled: boolean;
  start_after_days: number;
  every_days: number;
  remind_before_days: number;
  optouts: number;
  sent_30d: number;
  last_sent_at: string | null;
  customers_owing: number;
}

/**
 * Perfil → Notificaciones → "Cobranza automática por WhatsApp" (complemento
 * pago `wa_credit_reminders`). Cada día a las 9 a.m. (VE) se le escribe por
 * WhatsApp a cada cliente con órdenes a crédito: UN mensaje por cliente con el
 * total que debe, cada N días hasta que la orden se marque pagada. Sin el
 * complemento se muestra bloqueado con el CTA para comprarlo. Ver migración
 * 20261114_customer_credit_reminders.sql y la edge send-customer-credit-reminders.
 */
@Component({
  selector: 'lib-customer-reminders',
  imports: [DatePipe, FormsModule, TranslocoPipe, ButtonComponent, IconComponent, ToggleComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4" data-testid="customer-reminders">
      <div class="flex items-start justify-between gap-3">
        <div class="flex flex-col gap-1 min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <h2 class="text-lg font-bold text-grey-800">{{ 'Cobranza automática por WhatsApp' | transloco }}</h2>
            @if (status()?.addon_active) {
              <span class="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                {{ 'Activo' | transloco }}
              </span>
            } @else {
              <span class="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                <ui-icon name="crown" size="12" />
                {{ 'Complemento' | transloco }}
              </span>
            }
          </div>
          <p class="text-sm text-grey-400">
            {{ 'Le escribimos por WhatsApp a tus clientes que te deben (órdenes a crédito) para recordarles el pago. Un solo mensaje por cliente con el total, hasta que marques la orden como pagada.' | transloco }}
          </p>
        </div>
        @if (status()?.addon_active) {
          <ui-toggle
            toggleId="customer-reminders-toggle"
            [ngModel]="enabled()"
            (ngModelChange)="enabled.set($event)"
          ></ui-toggle>
        }
      </div>

      @if (loading()) {
        <div class="h-16 rounded-lg bg-grey-25 animate-pulse"></div>
      } @else if (status(); as s) {
        @if (s.addon_active) {
          @if (enabled()) {
            <div class="flex flex-col gap-2 pl-1 text-sm text-grey-600">
              <div class="flex flex-wrap items-center gap-2">
                <span>{{ 'Plazo para pagar:' | transloco }}</span>
                <input
                  type="number"
                  min="0"
                  max="90"
                  data-testid="cr-start-days"
                  [ngModel]="startAfterDays()"
                  (ngModelChange)="startAfterDays.set($event)"
                  class="w-16 rounded-md border border-grey-200 px-2 py-1 text-center focus:border-primary-500 focus:outline-none"
                />
                <span>{{ 'días desde la orden (o la fecha de la cuota, si tiene).' | transloco }}</span>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span>{{ 'Avisar' | transloco }}</span>
                <select
                  data-testid="cr-before-days"
                  [ngModel]="remindBeforeDays()"
                  (ngModelChange)="remindBeforeDays.set(+$event)"
                  class="rounded-md border border-grey-200 px-2 py-1 focus:border-primary-500 focus:outline-none bg-white"
                >
                  @for (d of beforeOptions; track d) {
                    <option [ngValue]="d">{{ d === 0 ? ('no avisar' | transloco) : d + ' ' + ((d === 1 ? 'día' : 'días') | transloco) }}</option>
                  }
                </select>
                <span>{{ 'antes de que venza, y otro aviso el día que vence.' | transloco }}</span>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <span>{{ 'Ya vencida, repetir' | transloco }}</span>
                <select
                  data-testid="cr-every-days"
                  [ngModel]="everyDays()"
                  (ngModelChange)="everyDays.set(+$event)"
                  class="rounded-md border border-grey-200 px-2 py-1 focus:border-primary-500 focus:outline-none bg-white"
                >
                  @for (d of everyOptions; track d) {
                    <option [ngValue]="d">{{ d === 1 ? ('todos los días' | transloco) : ('cada' | transloco) + ' ' + d + ' ' + ('días' | transloco) }}</option>
                  }
                </select>
                <span>{{ 'hasta que pague.' | transloco }}</span>
              </div>
            </div>
          }

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div class="rounded-lg bg-grey-25 px-3 py-2">
              <p class="text-xs text-grey-400">{{ 'Clientes que te deben' | transloco }}</p>
              <p class="text-lg font-bold text-grey-800">{{ s.customers_owing }}</p>
            </div>
            <div class="rounded-lg bg-grey-25 px-3 py-2">
              <p class="text-xs text-grey-400">{{ 'Recordatorios (30 días)' | transloco }}</p>
              <p class="text-lg font-bold text-grey-800">{{ s.sent_30d }}</p>
            </div>
            <div class="rounded-lg bg-grey-25 px-3 py-2">
              <p class="text-xs text-grey-400">{{ 'Pidieron no recibir más' | transloco }}</p>
              <p class="text-lg font-bold text-grey-800">{{ s.optouts }}</p>
            </div>
          </div>

          <p class="text-xs text-grey-400">
            {{ 'Se envían todos los días a las 9 a.m. desde el número de avisos de CatalogoHoy, con el WhatsApp de tu tienda para que te escriban. Si el cliente toca «No recibir más recordatorios», no le escribimos más.' | transloco }}
            @if (s.active_until) {
              {{ 'Complemento activo hasta el' | transloco }} {{ s.active_until | date: 'dd/MM/yyyy' }}.
            }
          </p>

          <div class="flex justify-end">
            <ui-button
              label="Guardar"
              severity="primary"
              [fluid]="false"
              [isLoading]="saving()"
              [disabled]="!dirty()"
              (click)="save()"
            />
          </div>
        } @else {
          <div class="rounded-xl border border-amber-200 bg-amber-50 p-4 flex flex-col gap-3" data-testid="cr-locked">
            <div class="flex items-start gap-3">
              <span class="flex items-center justify-center w-9 h-9 rounded-xl bg-white shrink-0">
                <ui-icon name="crown" size="17" styleClass="text-amber-500" />
              </span>
              <div class="flex flex-col gap-1">
                <p class="text-sm font-semibold text-grey-800">
                  {{ 'Complemento de $10 al mes' | transloco }}
                </p>
                <p class="text-sm text-grey-600">
                  {{ 'Cada mensaje de WhatsApp tiene un costo, por eso este envío automático se cobra aparte de tu plan. El botón manual «Recordatorio de cobro» de cada orden sigue incluido.' | transloco }}
                </p>
                @if (s.customers_owing > 0) {
                  <p class="text-sm text-grey-600">
                    {{ 'Hoy tienes' | transloco }} <strong>{{ s.customers_owing }}</strong>
                    {{ 'clientes con órdenes a crédito.' | transloco }}
                  </p>
                }
              </div>
            </div>
            <a
              [href]="buyUrl()"
              target="_blank"
              rel="noopener"
              data-testid="cr-buy"
              class="self-start inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-semibold hover:bg-primary-600"
            >
              <ui-icon name="message-circle" size="16" />
              {{ 'Activar complemento' | transloco }}
            </a>
          </div>
        }
      }
    </div>
  `,
})
export class CustomerRemindersComponent implements OnInit {
  private readonly client = SupabaseClientProvider.getInstance();
  private readonly tenantStore = inject(TenantStore);
  private readonly toast = inject(ToastService);

  public readonly everyOptions = [1, 3, 7, 15, 30];
  public readonly beforeOptions = [0, 1, 2, 3];

  public readonly loading = signal(true);
  public readonly saving = signal(false);
  public readonly status = signal<ReminderStatus | null>(null);
  public readonly enabled = signal(false);
  public readonly startAfterDays = signal(3);
  public readonly everyDays = signal(7);
  public readonly remindBeforeDays = signal(2);
  private readonly tenantName = signal('');

  public readonly dirty = computed(() => {
    const s = this.status();
    if (!s) return false;
    return (
      s.enabled !== this.enabled() ||
      s.start_after_days !== Number(this.startAfterDays()) ||
      s.every_days !== Number(this.everyDays()) ||
      (s.remind_before_days ?? 2) !== Number(this.remindBeforeDays())
    );
  });

  public readonly buyUrl = computed(() => {
    const store = this.tenantName() ? ` para mi tienda ${this.tenantName()}` : '';
    const text = `Hola! Quiero activar la cobranza automática por WhatsApp${store}.`;
    return `https://wa.me/${SUPPORT_WA}?text=${encodeURIComponent(text)}`;
  });

  private tenantId: number | null = null;

  async ngOnInit(): Promise<void> {
    this.tenantId = await this.tenantStore.getTenantIdAsync();
    if (this.tenantId) {
      const { data } = await this.client.from('tenants').select('name').eq('id', this.tenantId).maybeSingle();
      this.tenantName.set(((data as { name?: string } | null)?.name ?? '').trim());
    }
    await this.load();
  }

  private async load(): Promise<void> {
    if (!this.tenantId) return;
    this.loading.set(true);
    const { data, error } = await this.client.rpc('customer_reminders_status', { p_tenant_id: this.tenantId });
    this.loading.set(false);
    if (error || !data) {
      this.toast.error(new Exception('No pudimos cargar la cobranza automática.'));
      return;
    }
    const s = data as ReminderStatus;
    this.status.set(s);
    this.enabled.set(s.enabled);
    this.startAfterDays.set(s.start_after_days);
    this.everyDays.set(s.every_days);
    this.remindBeforeDays.set(s.remind_before_days ?? 2);
  }

  public async save(): Promise<void> {
    if (!this.tenantId || this.saving()) return;
    const start = Math.min(90, Math.max(0, Math.round(Number(this.startAfterDays()) || 0)));
    this.saving.set(true);
    const { error } = await this.client.rpc('customer_reminders_save', {
      p_tenant_id: this.tenantId,
      p_enabled: this.enabled(),
      p_start_after_days: start,
      p_every_days: Number(this.everyDays()),
      p_remind_before_days: Number(this.remindBeforeDays()),
    });
    this.saving.set(false);
    if (error) {
      const msg = error.message.includes('forbidden')
        ? 'Solo el dueño o un administrador puede cambiar esto.'
        : error.message.includes('addon_required')
          ? 'Tu complemento de cobranza automática no está activo.'
          : 'No pudimos guardar los cambios.';
      this.toast.error(new Exception(msg));
      return;
    }
    this.toast.success(
      this.enabled() ? 'Listo. Los recordatorios salen cada día a las 9 a.m.' : 'Cobranza automática apagada.'
    );
    await this.load();
  }
}
