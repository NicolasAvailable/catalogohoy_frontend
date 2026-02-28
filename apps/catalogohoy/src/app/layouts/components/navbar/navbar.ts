import { Clipboard } from '@angular/cdk/clipboard';
import { Component, computed, inject, OnInit, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PlanStore } from '@catalogohoy/plan';
import { ProfileStore } from '@catalogohoy/profile';
import { is, qr } from '@shared/domain';
import { BaseComponent } from '@shared/presenter';
import {
  AvatarComponent,
  ButtonComponent,
  IconComponent,
  TooltipDirective,
} from '@ui';
import { ProfileMenu } from './components';

@Component({
  selector: 'app-navbar',
  imports: [
    AvatarComponent,
    ButtonComponent,
    IconComponent,
    TooltipDirective,
    ProfileMenu,
    RouterLink,
  ],
  templateUrl: './navbar.html',
})
export class Navbar extends BaseComponent implements OnInit {
  public toggleSidebar = output<void>();
  private readonly clipboard = inject(Clipboard);
  public readonly profileStore = inject(ProfileStore);
  public readonly planStore = inject(PlanStore);

  private readonly PLAN_PALETTE: Record<string, { color: string; bg: string }> = {
    gratis:   { color: '#64748b', bg: '#f1f5f9' },
    basico:   { color: '#6366f1', bg: '#eef2ff' },
    avanzado: { color: '#7c3aed', bg: '#f5f3ff' },
  };

  public readonly currentPlanPalette = computed(() => {
    const id = this.planStore.currentPlan()?.id ?? '';
    return this.PLAN_PALETTE[id] ?? this.PLAN_PALETTE['basico'];
  });

  ngOnInit(): void {
    this.planStore.loadTenantPlanUsage();
  }

  public share() {
    const url = this.profileStore.profile().tenantList.first.url;
    is.affirmative(this.clipboard.copy(url)).mapRight(() =>
      this.useCaseProgress
        .completeFor('Se ha copiado al portapapeles')
        .complete()
    );
  }

  public async generateQR() {
    const tenant = this.profileStore.profile().tenantList.first;

    await qr.to.pdf(tenant.url, `QR-${tenant.slug}`, tenant.name);

    this.useCaseProgress.completeFor('QR generado con éxito').complete();
  }
}
