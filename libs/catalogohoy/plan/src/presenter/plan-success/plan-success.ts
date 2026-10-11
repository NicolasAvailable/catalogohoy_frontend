import { Component, OnDestroy, OnInit, inject } from '@angular/core';
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
export class PlanSuccess implements OnInit, OnDestroy {
  private readonly router   = inject(Router);
  private readonly planStore = inject(PlanStore);

  private redirectTimer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    // refreshUsage (no loadTenantPlanUsage, que early-returnea si ya había
    // datos) fuerza el refetch para que el plan/trial nuevo quede activo en el
    // home apenas el webhook lo aplica.
    this.planStore.loadPlans();
    this.planStore.refreshUsage();
    // Llevamos al inicio tras unos segundos (alcanza a ver el "listo"); el plan
    // ya quedó activo. Si toca un botón antes, navega y el timer se limpia.
    this.redirectTimer = setTimeout(() => this.goHome(), 5000);
  }

  ngOnDestroy(): void {
    if (this.redirectTimer) clearTimeout(this.redirectTimer);
  }

  public goHome(): void {
    this.router.navigate(['/admin']);
  }

  public goPlans(): void {
    this.router.navigate(['/admin/plans']);
  }
}
