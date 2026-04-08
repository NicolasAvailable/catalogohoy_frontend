import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Sidebar } from './components/sidebar/sidebar';
import { Topbar } from './components/topbar/topbar';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, Sidebar, Topbar],
  template: `
    <main class="flex w-full h-screen overflow-hidden bg-grey-25">
      <app-sidebar
        [visible]="sidebarOpen()"
        (closeSidebar)="sidebarOpen.set(false)"
      />
      <section class="flex flex-auto flex-col overflow-hidden">
        <app-topbar (toggleSidebar)="toggleSidebar()" />
        <div class="flex w-full flex-auto flex-col overflow-y-auto p-6">
          <router-outlet />
        </div>
      </section>
    </main>
  `,
})
export default class Layout {
  public readonly sidebarOpen = signal(false);

  public toggleSidebar(): void {
    this.sidebarOpen.update((v) => !v);
  }
}
