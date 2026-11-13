import { DatePipe } from '@angular/common';
import { Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { IconComponent } from '@ui';
import {
  acquisitionLabel,
  PAY_SOURCE_CLASS,
  PAY_SOURCE_ICON,
  PAY_SOURCE_LABEL,
  PLATFORM_LABEL,
  providerLabel,
} from '../shared/origin/origin.model';
import { PlatformUser } from './users.model';
import { UsersStore } from './users.store';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe, RouterLink],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Usuarios</h1>
        <p class="text-sm text-grey-400">
          Todos los usuarios registrados en la plataforma. Los planes se
          asignan a los catálogos, no a los usuarios.
        </p>
      </header>

      <section class="flex items-center gap-3 shrink-0">
        <div
          class="flex items-center gap-2 px-3 py-2 bg-white border border-grey-50 rounded-md flex-1 max-w-md"
        >
          <ui-icon name="search" size="16" styleClass="text-grey-400" />
          <input
            type="text"
            placeholder="Buscar por nombre, email o teléfono..."
            class="flex-1 outline-none text-sm text-grey-700 placeholder:text-grey-300 bg-transparent"
            [ngModel]="searchTerm()"
            (ngModelChange)="onSearchChange($event)"
          />
        </div>
        <span class="text-sm text-grey-400">
          {{ store.users().length }} de {{ store.total() }}
        </span>
        <button
          type="button"
          (click)="store.load()"
          class="inline-flex items-center justify-center w-9 h-9 rounded-md bg-white border border-grey-50 hover:bg-grey-50 transition-colors cursor-pointer"
          aria-label="Recargar"
        >
          <ui-icon name="refresh-cw" size="14" styleClass="text-grey-500" />
        </button>
      </section>

      @if (store.error()) {
        <div
          class="flex items-center gap-2 px-4 py-3 rounded-md bg-red-50 border border-red-100 shrink-0"
        >
          <ui-icon name="circle-alert" size="16" styleClass="text-red-500" />
          <span class="text-sm text-red-600">{{ store.error() }}</span>
        </div>
      }

      <section
        class="flex-1 min-h-0 bg-white rounded-xl border border-grey-50 overflow-hidden flex flex-col"
      >
        <div class="flex-1 min-h-0 overflow-auto">
          <table class="w-full text-sm border-separate border-spacing-0">
            <thead>
              <tr>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Usuario
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Contacto
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Registro
                </th>
                <th
                  class="sticky top-0 z-10 text-left text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Catálogos
                </th>
                <th
                  class="sticky top-0 z-10 text-right text-xs uppercase tracking-wide font-semibold text-grey-500 px-4 py-3 bg-white border-b border-grey-100"
                >
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              @if (store.isLoading()) {
                <tr>
                  <td colspan="5" class="px-4 py-12 text-center">
                    <div class="flex flex-col items-center gap-2">
                      <ui-icon
                        name="loader-circle"
                        size="24"
                        styleClass="text-grey-300 animate-spin"
                      />
                      <p class="text-sm text-grey-400">Cargando usuarios...</p>
                    </div>
                  </td>
                </tr>
              } @else {
                @for (user of store.users(); track user.id) {
                  <tr
                    class="hover:bg-grey-25 transition-colors"
                    [class.opacity-60]="user.isBanned"
                  >
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex items-center gap-3">
                        @if (user.avatarUrl && !brokenAvatars().has(user.id)) {
                          <img
                            [src]="user.avatarUrl"
                            [alt]="displayName(user)"
                            referrerpolicy="no-referrer"
                            (error)="onAvatarError(user.id)"
                            class="w-9 h-9 rounded-full object-cover shrink-0 border border-grey-50"
                          />
                        } @else {
                          <div
                            class="w-9 h-9 rounded-full bg-primary-500 flex items-center justify-center shrink-0 text-white text-sm font-semibold uppercase"
                          >
                            {{ initial(user) }}
                          </div>
                        }
                        <div class="flex flex-col min-w-0">
                          <strong class="font-semibold text-grey-700 truncate">
                            {{ displayName(user) }}
                          </strong>
                          <span class="flex items-center gap-2 text-xs text-grey-400">
                            ID #{{ user.id }}
                            @if (user.isBanned) {
                              <span
                                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-semibold"
                              >
                                <ui-icon name="ban" size="10" />
                                Baneado
                              </span>
                            }
                          </span>
                        </div>
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex flex-col">
                        @if (user.email) {
                          <span class="text-grey-700">{{ user.email }}</span>
                        }
                        @if (user.phone) {
                          <span class="text-xs text-grey-400">{{ user.phone }}</span>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 text-grey-500 border-b border-grey-50">
                      <div class="flex flex-col">
                        <span>{{ user.createdAt | date: 'dd/MM/yyyy' }}</span>
                        <span class="text-xs text-grey-400">
                          @if (user.lastSignInAt) {
                            Último acceso {{ user.lastSignInAt | date: 'dd/MM/yyyy HH:mm' }}
                          } @else {
                            Nunca entró
                          }
                          @if (user.provider) {
                            · {{ providerLabel(user.provider) }}
                          }
                        </span>
                        <span class="text-xs text-grey-400">
                          Desde:
                          {{ user.signupPlatform ? platformLabel[user.signupPlatform] : 'sin dato' }}
                          @if (acquisition(user); as acq) {
                            · vino de {{ acq }}
                          }
                        </span>
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50">
                      <div class="flex flex-wrap gap-1">
                        @for (t of user.tenants; track t.id) {
                          <a
                            [routerLink]="['/tenants', t.id]"
                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-grey-50 hover:bg-grey-100 text-xs text-grey-600 transition-colors"
                          >
                            <ui-icon name="store" size="12" />
                            {{ t.name || t.slug || '#' + t.id }}
                          </a>
                          @if (t.paySource) {
                            <span
                              class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold {{ payClass[t.paySource] }}"
                              [title]="'Paga por ' + payLabel[t.paySource]"
                            >
                              <ui-icon [name]="payIcon[t.paySource]" size="12" />
                              {{ payLabel[t.paySource] }}
                            </span>
                          }
                        } @empty {
                          <span class="text-xs text-grey-300">Sin catálogo</span>
                        }
                      </div>
                    </td>
                    <td class="px-4 py-3 border-b border-grey-50 text-right">
                      <button
                        type="button"
                        (click)="toggleMenu(user, $event)"
                        [disabled]="busyId() === user.id"
                        class="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-grey-50 transition-colors cursor-pointer disabled:opacity-50"
                        aria-label="Acciones"
                      >
                        @if (busyId() === user.id) {
                          <ui-icon name="loader-circle" size="16" styleClass="text-grey-400 animate-spin" />
                        } @else {
                          <ui-icon name="ellipsis-vertical" size="16" styleClass="text-grey-500" />
                        }
                      </button>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="5" class="px-4 py-12 text-center">
                      <div class="flex flex-col items-center gap-2">
                        <ui-icon
                          name="users"
                          size="28"
                          styleClass="text-grey-300"
                        />
                        <p class="text-sm text-grey-400">
                          No hay usuarios para mostrar.
                        </p>
                      </div>
                    </td>
                  </tr>
                }
              }
            </tbody>
          </table>
        </div>

        @if (!store.isLoading() && store.users().length < store.total()) {
          <div class="shrink-0 border-t border-grey-50 p-3 flex justify-center">
            <button
              type="button"
              (click)="store.loadMore()"
              [disabled]="store.isLoadingMore()"
              class="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-white border border-grey-50 hover:bg-grey-50 transition-colors cursor-pointer text-sm font-semibold text-grey-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              @if (store.isLoadingMore()) {
                <ui-icon name="loader-circle" size="14" styleClass="text-grey-400 animate-spin" />
                Cargando...
              } @else {
                <ui-icon name="chevron-down" size="14" styleClass="text-grey-500" />
                Cargar más ({{ store.users().length }} de {{ store.total() }})
              }
            </button>
          </div>
        }
      </section>
    </div>

    @if (notice(); as n) {
      <div
        class="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm text-white"
        [class.bg-emerald-600]="n.ok"
        [class.bg-red-600]="!n.ok"
      >
        <ui-icon [name]="n.ok ? 'circle-check' : 'circle-alert'" size="16" />
        {{ n.text }}
      </div>
    }

    @if (menu(); as m) {
      <div class="fixed inset-0 z-40" (click)="closeMenu()"></div>
      <div
        class="fixed z-50 w-60 py-1 bg-white border border-grey-50 rounded-lg shadow-lg text-sm"
        [style.top.px]="m.top"
        [style.right.px]="m.right"
      >
        @if (m.user.email) {
          <button type="button" class="menu-item" (click)="copy(m.user.email)">
            <ui-icon name="copy" size="14" /> Copiar email
          </button>
          <a class="menu-item" [href]="'mailto:' + m.user.email" (click)="closeMenu()">
            <ui-icon name="mail" size="14" /> Enviar email
          </a>
        }
        @if (whatsappUrl(m.user); as wa) {
          <a class="menu-item" [href]="wa" target="_blank" rel="noopener" (click)="closeMenu()">
            <ui-icon name="message-circle" size="14" /> Escribir por WhatsApp
          </a>
        }
        @for (t of m.user.tenants; track t.id) {
          <a class="menu-item" [routerLink]="['/tenants', t.id]" (click)="closeMenu()">
            <ui-icon name="store" size="14" /> Ver catálogo {{ t.name || t.slug }}
          </a>
          @if (t.slug) {
            <a
              class="menu-item"
              [href]="'https://' + t.slug + '.catalogohoy.com'"
              target="_blank"
              rel="noopener"
              (click)="closeMenu()"
            >
              <ui-icon name="external-link" size="14" /> Abrir tienda pública
            </a>
          }
        }
        <div class="my-1 border-t border-grey-50"></div>
        <button type="button" class="menu-item" (click)="onSignOut(m.user)">
          <ui-icon name="log-out" size="14" /> Cerrar sus sesiones
        </button>
        @if (m.user.isBanned) {
          <button type="button" class="menu-item !text-emerald-600" (click)="onToggleBan(m.user)">
            <ui-icon name="user-check" size="14" /> Desbanear usuario
          </button>
        } @else {
          <button type="button" class="menu-item !text-red-600" (click)="onToggleBan(m.user)">
            <ui-icon name="user-x" size="14" /> Banear usuario
          </button>
        }
      </div>
    }
  `,
  styles: `
    .menu-item {
      display: flex;
      width: 100%;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      text-align: left;
      color: var(--color-grey-700, #374151);
      cursor: pointer;
    }
    .menu-item:hover {
      background: var(--color-grey-50, #f3f4f6);
    }
  `,
})
export class Users implements OnInit, OnDestroy {
  protected readonly store = inject(UsersStore);

  protected readonly searchTerm = signal('');
  protected readonly brokenAvatars = signal<Set<number>>(new Set());

  protected readonly busyId = signal<number | null>(null);
  protected readonly menu = signal<{
    user: PlatformUser;
    top: number;
    right: number;
  } | null>(null);
  protected readonly notice = signal<{ ok: boolean; text: string } | null>(
    null
  );

  private searchTimer: ReturnType<typeof setTimeout> | null = null;
  private noticeTimer: ReturnType<typeof setTimeout> | null = null;

  ngOnInit(): void {
    this.store.load();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) clearTimeout(this.searchTimer);
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
  }

  /** Menú en posición fija para que no lo corte el scroll de la tabla. */
  protected toggleMenu(user: PlatformUser, event: MouseEvent): void {
    if (this.menu()?.user.id === user.id) {
      this.closeMenu();
      return;
    }
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    const estimated = 320;
    const top =
      rect.bottom + estimated > window.innerHeight
        ? Math.max(8, rect.top - estimated)
        : rect.bottom + 4;
    this.menu.set({ user, top, right: window.innerWidth - rect.right });
  }

  protected closeMenu(): void {
    this.menu.set(null);
  }

  protected async copy(text: string): Promise<void> {
    this.closeMenu();
    try {
      await navigator.clipboard.writeText(text);
      this.showNotice(true, 'Email copiado');
    } catch {
      this.showNotice(false, 'No se pudo copiar');
    }
  }

  protected whatsappUrl(user: PlatformUser): string | null {
    const digits = (user.phone ?? '').replace(/\D/g, '');
    return digits.length >= 8 ? `https://wa.me/${digits}` : null;
  }

  protected readonly payLabel = PAY_SOURCE_LABEL;
  protected readonly payIcon = PAY_SOURCE_ICON;
  protected readonly payClass = PAY_SOURCE_CLASS;
  protected readonly platformLabel = PLATFORM_LABEL;

  protected providerLabel(provider: string): string {
    return providerLabel(provider) ?? provider;
  }

  protected acquisition(user: PlatformUser): string | null {
    return acquisitionLabel(user);
  }

  protected async onToggleBan(user: PlatformUser): Promise<void> {
    this.closeMenu();
    const willBan = !user.isBanned;
    const ok = window.confirm(
      `¿Seguro que quieres ${willBan ? 'BANEAR' : 'DESBANEAR'} a ${this.displayName(user)}?\n\n` +
        (willBan
          ? 'Se cierran sus sesiones y no podrá volver a iniciar sesión hasta que lo desbanees.'
          : 'Va a poder iniciar sesión normalmente otra vez.')
    );
    if (!ok) return;
    this.busyId.set(user.id);
    const res = await this.store.setBanned(user.id, willBan);
    this.busyId.set(null);
    res.fold(
      (err) => this.showNotice(false, `No se pudo: ${err.message}`),
      () =>
        this.showNotice(true, willBan ? 'Usuario baneado' : 'Usuario desbaneado')
    );
  }

  protected async onSignOut(user: PlatformUser): Promise<void> {
    this.closeMenu();
    const ok = window.confirm(
      `¿Cerrar todas las sesiones de ${this.displayName(user)}? Tendrá que volver a iniciar sesión.`
    );
    if (!ok) return;
    this.busyId.set(user.id);
    const res = await this.store.signOut(user.id);
    this.busyId.set(null);
    res.fold(
      (err) => this.showNotice(false, `No se pudo: ${err.message}`),
      (n) => this.showNotice(true, `Sesiones cerradas: ${n}`)
    );
  }

  private showNotice(ok: boolean, text: string): void {
    this.notice.set({ ok, text });
    if (this.noticeTimer) clearTimeout(this.noticeTimer);
    this.noticeTimer = setTimeout(() => this.notice.set(null), 3000);
  }

  /** Debounce keystrokes so search hits the server (not the loaded page). */
  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    if (this.searchTimer) clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.store.setSearch(term), 300);
  }

  protected onAvatarError(userId: number): void {
    this.brokenAvatars.update((set) => {
      const next = new Set(set);
      next.add(userId);
      return next;
    });
  }

  protected displayName(user: PlatformUser): string {
    const full = [user.name, user.lastName].filter(Boolean).join(' ').trim();
    return full || user.email || `Usuario #${user.id}`;
  }

  protected initial(user: PlatformUser): string {
    const source = user.name ?? user.email ?? '?';
    return source.trim().charAt(0).toUpperCase() || '?';
  }
}
