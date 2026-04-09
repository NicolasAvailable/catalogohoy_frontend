import { Component, inject, output } from '@angular/core';
import { Router } from '@angular/router';
import { IconComponent } from '@ui';
import { TooltipModule } from 'primeng/tooltip';
import { AuthStore } from '../../../modules/auth/auth.store';
import { ThemeStore } from '../../../modules/theme/theme.store';

@Component({
  selector: 'app-topbar',
  standalone: true,
  imports: [IconComponent, TooltipModule],
  template: `
    <header
      class="flex items-center justify-between h-16 px-6 bg-white border-b border-grey-50 shrink-0"
    >
      <button
        type="button"
        (click)="toggleSidebar.emit()"
        class="sm:hidden flex items-center justify-center w-9 h-9 rounded-md hover:bg-grey-50 transition-colors cursor-pointer"
        aria-label="Abrir menú"
      >
        <ui-icon name="menu" size="20" styleClass="text-grey-700" />
      </button>

      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-grey-700">Panel interno</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          (click)="themeStore.toggle()"
          class="flex items-center justify-center w-9 h-9 rounded-md hover:bg-grey-50 transition-colors cursor-pointer"
          [attr.aria-label]="
            themeStore.isDark() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'
          "
          [pTooltip]="themeStore.isDark() ? 'Modo claro' : 'Modo oscuro'"
          tooltipPosition="bottom"
        >
          @if (themeStore.isDark()) {
            <ui-icon name="sun" size="18" styleClass="text-grey-700" />
          } @else {
            <ui-icon name="moon" size="18" styleClass="text-grey-700" />
          }
        </button>

        @if (authStore.session(); as session) {
          <div
            class="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-md bg-grey-25 border border-grey-50"
          >
            <ui-icon name="user" size="14" styleClass="text-grey-500" />
            <span class="text-xs font-medium text-grey-700">
              {{ session.email }}
            </span>
          </div>
        }

        <button
          type="button"
          (click)="logout()"
          class="flex items-center justify-center w-9 h-9 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
          aria-label="Cerrar sesión"
          pTooltip="Cerrar sesión"
          tooltipPosition="bottom"
        >
          <ui-icon name="log-out" size="18" styleClass="text-red-500" />
        </button>
      </div>
    </header>
  `,
})
export class Topbar {
  public toggleSidebar = output<void>();

  protected readonly authStore = inject(AuthStore);
  protected readonly themeStore = inject(ThemeStore);
  private readonly router = inject(Router);

  protected async logout(): Promise<void> {
    await this.authStore.logout();
    this.router.navigateByUrl('/login');
  }
}
