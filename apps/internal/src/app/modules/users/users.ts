import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';
import { PlatformUser } from './users.model';
import { UsersStore } from './users.store';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [IconComponent, FormsModule, DatePipe],
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
            (ngModelChange)="searchTerm.set($event)"
          />
        </div>
        <span class="text-sm text-grey-400">
          {{ filteredUsers().length }} de {{ store.users().length }}
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
              </tr>
            </thead>
            <tbody>
              @if (store.isLoading()) {
                <tr>
                  <td colspan="3" class="px-4 py-12 text-center">
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
                @for (user of filteredUsers(); track user.id) {
                  <tr class="hover:bg-grey-25 transition-colors">
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
                          <span class="text-xs text-grey-400">
                            ID #{{ user.id }}
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
                      {{ user.createdAt | date: 'dd/MM/yyyy' }}
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3" class="px-4 py-12 text-center">
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
      </section>
    </div>
  `,
})
export class Users implements OnInit {
  protected readonly store = inject(UsersStore);

  protected readonly searchTerm = signal('');
  protected readonly brokenAvatars = signal<Set<number>>(new Set());

  protected readonly filteredUsers = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) return this.store.users();
    return this.store.users().filter((u) => {
      const name = this.displayName(u).toLowerCase();
      const email = (u.email ?? '').toLowerCase();
      const phone = (u.phone ?? '').toLowerCase();
      return (
        name.includes(term) || email.includes(term) || phone.includes(term)
      );
    });
  });

  ngOnInit(): void {
    this.store.load();
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
