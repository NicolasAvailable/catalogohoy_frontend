import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { PlanStore } from '../../infrastructure';

@Component({
  selector: 'lib-plan-success',
  imports: [IconComponent, TranslocoPipe],
  templateUrl: './plan-success.html',
  host: { class: 'flex-1 flex flex-col min-h-0' },
})
export class PlanSuccess implements OnInit {
  private readonly router   = inject(Router);
  private readonly planStore = inject(PlanStore);

  ngOnInit(): void {
    // Reload plan data so the UI reflects the new plan once the webhook fires
    this.planStore.loadPlans();
    this.planStore.loadTenantPlanUsage();
  }

  public goHome(): void {
    this.router.navigate(['/admin']);
  }

  public goPlans(): void {
    this.router.navigate(['/admin/plans']);
  }
}
