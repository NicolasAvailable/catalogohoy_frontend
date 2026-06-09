import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ExpirationBannerComponent, PlanStore } from '@catalogohoy/plan';
import { WhatsappSupportComponent } from '@ui';
import { Navbar, Sidebar } from '../../components';

@Component({
  selector: 'app-base',
  imports: [RouterOutlet, Navbar, Sidebar, WhatsappSupportComponent, ExpirationBannerComponent],
  templateUrl: './base.html',
})
export class Base implements OnInit {
  private readonly planStore = inject(PlanStore);

  public readonly sidebarOpen = signal(false);

  ngOnInit() {
    this.planStore.loadTenantPlanUsage();
  }

  public toggleSidebar() {
    this.sidebarOpen.update((v: boolean) => !v);
  }
}
