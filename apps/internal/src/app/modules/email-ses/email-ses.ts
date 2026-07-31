import { DecimalPipe, PercentPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { IconComponent } from '@ui';
import { SesDaily, SesStats } from './email-ses.model';
import { EmailSesService } from './email-ses.service';

type Health = { label: string; tone: 'ok' | 'warn' | 'bad' };

@Component({
  selector: 'app-email-ses',
  standalone: true,
  imports: [IconComponent, DecimalPipe, PercentPipe],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0 overflow-auto pb-2">
      <header class="flex items-start justify-between gap-4 shrink-0">
        <div class="flex flex-col gap-1">
          <h1 class="text-2xl font-bold text-grey-700">Emails</h1>
          <p class="text-sm text-grey-400 max-w-2xl">
            Correo transaccional enviado con Amazon SES (pedidos, reportes,
            billing, invitaciones). Estadísticas de los últimos
            {{ stats()?.windowDays ?? 14 }} días — es la ventana que conserva
            SES.
          </p>
        </div>
        <button
          type="button"
          (click)="load()"
          class="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white border border-grey-50 hover:bg-grey-50 transition-colors cursor-pointer shrink-0"
          aria-label="Recargar"
        >
          <ui-icon
            name="refresh-cw"
            size="14"
            [styleClass]="
              isLoading() ? 'text-grey-400 animate-spin' : 'text-grey-500'
            "
          />
        </button>
      </header>

      @if (error()) {
        <div
          class="flex items-center gap-2 px-4 py-3 rounded-md bg-red-50 border border-red-100 shrink-0"
        >
          <ui-icon name="circle-alert" size="16" styleClass="text-red-500" />
          <span class="text-sm text-red-600">{{ error() }}</span>
        </div>
      }

      @if (isLoading() && !stats()) {
        <div class="flex-1 flex flex-col items-center justify-center gap-2">
          <ui-icon
            name="loader-circle"
            size="26"
            styleClass="text-grey-300 animate-spin"
          />
          <p class="text-sm text-grey-400">Cargando métricas de SES…</p>
        </div>
      } @else if (stats(); as s) {
        <!-- Cuota / estado -->
        <section class="grid grid-cols-1 sm:grid-cols-3 gap-4 shrink-0">
          <article class="bg-white rounded-xl border border-grey-50 p-4">
            <div class="flex items-center justify-between">
              <span class="text-xs text-grey-400">Enviados hoy</span>
              <ui-icon name="gauge" size="16" styleClass="text-grey-300" />
            </div>
            <div class="flex items-end gap-1.5 mt-1">
              <strong class="text-2xl font-bold text-grey-700">{{
                s.quota?.SentLast24Hours ?? 0 | number
              }}</strong>
              <span class="text-sm text-grey-400 mb-0.5"
                >/ {{ s.quota?.Max24HourSend ?? 0 | number }}</span
              >
            </div>
            <div class="h-2 mt-2 rounded-full bg-grey-50 overflow-hidden">
              <div
                class="h-full rounded-full bg-primary-400 transition-all"
                [style.width.%]="quotaPct(s)"
              ></div>
            </div>
            <span class="block text-[0.7rem] text-grey-400 mt-1.5"
              >Límite diario de la cuenta</span
            >
          </article>

          <article
            class="bg-white rounded-xl border border-grey-50 p-4 flex flex-col justify-between"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs text-grey-400">Ritmo máximo</span>
              <ui-icon name="zap" size="16" styleClass="text-grey-300" />
            </div>
            <div class="flex items-end gap-1 mt-1">
              <strong class="text-2xl font-bold text-grey-700">{{
                s.quota?.MaxSendRate ?? 0 | number
              }}</strong>
              <span class="text-sm text-grey-400 mb-0.5">emails / segundo</span>
            </div>
            <span class="block text-[0.7rem] text-grey-400 mt-1.5"
              >Velocidad de envío permitida</span
            >
          </article>

          <article
            class="bg-white rounded-xl border border-grey-50 p-4 flex flex-col gap-2"
          >
            <span class="text-xs text-grey-400">Estado de la cuenta</span>
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold"
                [class]="
                  s.prodAccess
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-amber-50 text-amber-600'
                "
              >
                <ui-icon
                  [name]="s.prodAccess ? 'circle-check' : 'triangle-alert'"
                  size="13"
                />
                {{ s.prodAccess ? 'Producción' : 'Sandbox' }}
              </span>
              <span
                class="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold"
                [class]="
                  s.sendingEnabled
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                "
              >
                <ui-icon
                  [name]="s.sendingEnabled ? 'circle-check' : 'circle-x'"
                  size="13"
                />
                {{ s.sendingEnabled ? 'Envío activo' : 'Pausado' }}
              </span>
            </div>
            <span class="block text-[0.7rem] text-grey-400"
              >Región {{ region }}</span
            >
          </article>
        </section>

        <!-- KPIs -->
        <section class="grid grid-cols-2 lg:grid-cols-5 gap-4 shrink-0">
          <article class="bg-white rounded-xl border border-grey-50 p-4">
            <div
              class="flex items-center justify-center w-9 h-9 rounded-lg bg-primary-50 mb-2"
            >
              <ui-icon name="send" size="16" styleClass="text-primary-500" />
            </div>
            <span class="text-xs text-grey-400">Enviados</span>
            <strong class="block text-xl font-bold text-grey-700">{{
              s.totals.attempts | number
            }}</strong>
          </article>

          <article class="bg-white rounded-xl border border-grey-50 p-4">
            <div
              class="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-50 mb-2"
            >
              <ui-icon
                name="circle-check-big"
                size="16"
                styleClass="text-emerald-500"
              />
            </div>
            <span class="text-xs text-grey-400">Entregados</span>
            <strong class="block text-xl font-bold text-grey-700">{{
              s.totals.delivered | number
            }}</strong>
            <span class="text-[0.7rem] text-emerald-600 font-medium"
              >{{ deliveredRate(s) | percent: '1.0-1' }} entrega</span
            >
          </article>

          <article class="bg-white rounded-xl border border-grey-50 p-4">
            <div
              class="flex items-center justify-center w-9 h-9 rounded-lg mb-2"
              [class]="toneBg(bounceHealth(s).tone)"
            >
              <ui-icon
                name="undo-2"
                size="16"
                [styleClass]="toneText(bounceHealth(s).tone)"
              />
            </div>
            <span class="text-xs text-grey-400">Rebotes</span>
            <strong class="block text-xl font-bold text-grey-700">{{
              s.totals.bounces | number
            }}</strong>
            <span
              class="text-[0.7rem] font-medium"
              [class]="toneText(bounceHealth(s).tone)"
              >{{ s.bounceRate | percent: '1.0-2' }}</span
            >
          </article>

          <article class="bg-white rounded-xl border border-grey-50 p-4">
            <div
              class="flex items-center justify-center w-9 h-9 rounded-lg mb-2"
              [class]="toneBg(complaintHealth(s).tone)"
            >
              <ui-icon
                name="flag"
                size="16"
                [styleClass]="toneText(complaintHealth(s).tone)"
              />
            </div>
            <span class="text-xs text-grey-400">Quejas (spam)</span>
            <strong class="block text-xl font-bold text-grey-700">{{
              s.totals.complaints | number
            }}</strong>
            <span
              class="text-[0.7rem] font-medium"
              [class]="toneText(complaintHealth(s).tone)"
              >{{ s.complaintRate | percent: '1.0-2' }}</span
            >
          </article>

          <article class="bg-white rounded-xl border border-grey-50 p-4">
            <div
              class="flex items-center justify-center w-9 h-9 rounded-lg bg-grey-50 mb-2"
            >
              <ui-icon name="ban" size="16" styleClass="text-grey-400" />
            </div>
            <span class="text-xs text-grey-400">Rechazos</span>
            <strong class="block text-xl font-bold text-grey-700">{{
              s.totals.rejects | number
            }}</strong>
            <span class="text-[0.7rem] text-grey-400">bloqueados por SES</span>
          </article>
        </section>

        <!-- Serie diaria + Costo/Salud -->
        <section class="grid grid-cols-1 lg:grid-cols-3 gap-4 shrink-0">
          <!-- Chart -->
          <div class="lg:col-span-2 bg-white rounded-xl border border-grey-50 p-4">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-sm font-semibold text-grey-600">
                Envíos por día
              </h2>
              <div class="flex items-center gap-3 text-[0.7rem] text-grey-400">
                <span class="inline-flex items-center gap-1"
                  ><span class="w-2 h-2 rounded-sm bg-primary-400"></span
                  >Entregados</span
                >
                <span class="inline-flex items-center gap-1"
                  ><span class="w-2 h-2 rounded-sm bg-red-300"></span
                  >Rebotes</span
                >
              </div>
            </div>
            @if (s.daily.length) {
              <div class="flex items-end gap-1.5 h-40">
                @for (d of s.daily; track d.day) {
                  <div
                    class="flex-1 flex flex-col items-center justify-end gap-1 group relative min-w-0"
                    [title]="tooltip(d)"
                  >
                    <div
                      class="w-full flex flex-col justify-end"
                      style="height: 8.5rem"
                    >
                      @if (barH(d.bounces + d.rejects, s) > 0) {
                        <div
                          class="w-full bg-red-300 rounded-t"
                          [style.height.%]="barH(d.bounces + d.rejects, s)"
                        ></div>
                      }
                      <div
                        class="w-full bg-primary-400 group-hover:bg-primary-500 transition-colors"
                        [class.rounded-t]="barH(d.bounces + d.rejects, s) === 0"
                        [style.height.%]="barH(deliveredOf(d), s)"
                      ></div>
                    </div>
                    <span
                      class="text-[0.6rem] text-grey-400 whitespace-nowrap"
                      >{{ dayShort(d.day) }}</span
                    >
                  </div>
                }
              </div>
            } @else {
              <p class="text-sm text-grey-400 py-8 text-center">
                Sin envíos en el período.
              </p>
            }
          </div>

          <!-- Costo + salud -->
          <div class="flex flex-col gap-4">
            <div class="bg-white rounded-xl border border-grey-50 p-4">
              <div class="flex items-center gap-2 mb-1">
                <ui-icon
                  name="dollar-sign"
                  size="15"
                  styleClass="text-emerald-500"
                />
                <h2 class="text-sm font-semibold text-grey-600">Costo</h2>
              </div>
              <div class="flex items-end gap-1 mt-2">
                <strong class="text-2xl font-bold text-grey-700"
                  >\${{ s.cost.windowUsd | number: '1.2-4' }}</strong
                >
                <span class="text-xs text-grey-400 mb-1"
                  >últimos {{ s.windowDays }} días</span
                >
              </div>
              <div
                class="flex items-center justify-between mt-3 pt-3 border-t border-grey-50 text-sm"
              >
                <span class="text-grey-500">Este mes</span>
                <span class="font-semibold text-grey-700"
                  >\${{ s.cost.monthUsd | number: '1.2-4' }}</span
                >
              </div>
              <div class="flex items-center justify-between mt-1.5 text-sm">
                <span class="text-grey-500">Precio SES</span>
                <span class="text-grey-600"
                  >\${{ s.cost.pricePerThousandUsd | number: '1.2-2' }} /
                  1.000</span
                >
              </div>
            </div>

            <div class="bg-white rounded-xl border border-grey-50 p-4">
              <h2 class="text-sm font-semibold text-grey-600 mb-3">
                Salud de reputación
              </h2>
              <div class="flex items-center justify-between py-1.5">
                <span class="text-sm text-grey-600">Tasa de rebote</span>
                <span
                  class="inline-flex items-center gap-1.5 text-sm font-semibold"
                  [class]="toneText(bounceHealth(s).tone)"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full"
                    [class]="toneDot(bounceHealth(s).tone)"
                  ></span>
                  {{ bounceHealth(s).label }}
                </span>
              </div>
              <div
                class="flex items-center justify-between py-1.5 border-t border-grey-25"
              >
                <span class="text-sm text-grey-600">Tasa de quejas</span>
                <span
                  class="inline-flex items-center gap-1.5 text-sm font-semibold"
                  [class]="toneText(complaintHealth(s).tone)"
                >
                  <span
                    class="w-1.5 h-1.5 rounded-full"
                    [class]="toneDot(complaintHealth(s).tone)"
                  ></span>
                  {{ complaintHealth(s).label }}
                </span>
              </div>
              <p class="text-[0.7rem] text-grey-400 mt-2 leading-relaxed">
                SES revisa la cuenta si el rebote supera 5% o las quejas 0,1%.
              </p>
            </div>
          </div>
        </section>

        <!-- Nota: aperturas / clics -->
        @if (!s.trackingEnabled) {
          <section
            class="flex items-start gap-3 px-4 py-3 rounded-xl bg-grey-25 border border-grey-50 shrink-0"
          >
            <ui-icon
              name="mouse-pointer-click"
              size="16"
              styleClass="text-grey-400 mt-0.5"
            />
            <p class="text-xs text-grey-500 leading-relaxed">
              <strong class="text-grey-600">Aperturas y clics:</strong>
              todavía no se miden. Requiere activar el seguimiento de SES, que
              agrega un pixel invisible y reescribe los enlaces de cada correo.
              Se puede habilitar cuando quieras (fase 2).
            </p>
          </section>
        }
      }
    </div>
  `,
})
export class EmailSes implements OnInit {
  private readonly service = inject(EmailSesService);

  protected readonly stats = signal<SesStats | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly region = 'sa-east-1';

  protected readonly maxDaily = computed(() =>
    Math.max(1, ...(this.stats()?.daily.map((d) => d.attempts) ?? [1]))
  );

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.error.set(null);
    const result = await this.service.stats();
    result.mapRight((s) => this.stats.set(s));
    result.mapLeft((e) =>
      this.error.set(
        e.message || 'No se pudieron cargar las métricas de SES.'
      )
    );
    this.isLoading.set(false);
  }

  protected quotaPct(s: SesStats): number {
    const max = s.quota?.Max24HourSend ?? 0;
    if (max <= 0) return 0;
    return Math.min(100, Math.round(((s.quota?.SentLast24Hours ?? 0) / max) * 100));
  }

  protected deliveredRate(s: SesStats): number {
    return s.totals.attempts > 0 ? s.totals.delivered / s.totals.attempts : 0;
  }

  protected deliveredOf(d: SesDaily): number {
    return Math.max(0, d.attempts - d.bounces - d.rejects);
  }

  /** Altura % de un segmento de barra relativa al día de mayor volumen. */
  protected barH(value: number, _s: SesStats): number {
    return Math.round((value / this.maxDaily()) * 100);
  }

  protected dayShort(day: string): string {
    return `${day.slice(8, 10)}/${day.slice(5, 7)}`;
  }

  protected tooltip(d: SesDaily): string {
    return `${this.dayShort(d.day)} · ${d.attempts} enviados · ${d.bounces} rebotes · ${d.complaints} quejas`;
  }

  protected bounceHealth(s: SesStats): Health {
    const r = s.bounceRate;
    if (r > 0.05) return { label: 'En riesgo', tone: 'bad' };
    if (r > 0.02) return { label: 'Vigilar', tone: 'warn' };
    return { label: 'Saludable', tone: 'ok' };
  }

  protected complaintHealth(s: SesStats): Health {
    const r = s.complaintRate;
    if (r > 0.005) return { label: 'En riesgo', tone: 'bad' };
    if (r > 0.001) return { label: 'Vigilar', tone: 'warn' };
    return { label: 'Saludable', tone: 'ok' };
  }

  protected toneText(tone: Health['tone']): string {
    return tone === 'bad'
      ? 'text-red-600'
      : tone === 'warn'
        ? 'text-amber-600'
        : 'text-emerald-600';
  }

  protected toneBg(tone: Health['tone']): string {
    return tone === 'bad'
      ? 'bg-red-50'
      : tone === 'warn'
        ? 'bg-amber-50'
        : 'bg-emerald-50';
  }

  protected toneDot(tone: Health['tone']): string {
    return tone === 'bad'
      ? 'bg-red-500'
      : tone === 'warn'
        ? 'bg-amber-500'
        : 'bg-emerald-500';
  }

  ngOnInit(): void {
    this.load();
  }
}
