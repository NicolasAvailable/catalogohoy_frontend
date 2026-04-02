import {
  AfterViewInit,
  Component,
  effect,
  inject,
  Injector,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PlanExpiredDialogComponent, PlanStore } from '@catalogohoy/plan';
import { WhatsappSupportComponent } from '@ui';
import { Navbar, Sidebar } from '../../components';

@Component({
  selector: 'app-base',
  imports: [RouterOutlet, Navbar, Sidebar, PlanExpiredDialogComponent, WhatsappSupportComponent],
  templateUrl: './base.html',
})
export class Base implements OnInit, AfterViewInit {
  private readonly planStore = inject(PlanStore);
  private readonly injector = inject(Injector);

  @ViewChild(PlanExpiredDialogComponent)
  planExpiredDialog!: PlanExpiredDialogComponent;

  public readonly sidebarOpen = signal(false);

  ngOnInit() {
    this.planStore.loadTenantPlanUsage();
  }

  ngAfterViewInit() {
    effect(
      () => {
        if (this.planStore.isPlanExpired()) {
          this.planExpiredDialog.show();
        }
      },
      { injector: this.injector }
    );
  }

  public toggleSidebar() {
    this.sidebarOpen.update((v: boolean) => !v);
  }
}
