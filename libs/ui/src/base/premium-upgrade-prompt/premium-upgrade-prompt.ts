import { Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '../button';

/**
 * Full-height empty-state for premium-gated modules (Equipo, Analíticas).
 * Free-plan users can enter the route but see this instead of the feature,
 * with a single CTA that takes them to the plans page.
 */
@Component({
  selector: 'ui-premium-upgrade-prompt',
  standalone: true,
  imports: [LucideAngularModule, ButtonComponent],
  template: `
    <div
      class="flex flex-col items-center justify-center gap-6 py-20 px-6 text-center"
    >
      <div
        class="w-20 h-20 rounded-full bg-linear-to-br from-primary-50 to-violet-50 flex items-center justify-center text-primary-500"
      >
        <lucide-icon [name]="icon()" [size]="36" />
      </div>
      <div class="flex flex-col gap-2 max-w-md">
        <h2 class="text-2xl font-bold text-grey-800">{{ title() }}</h2>
        <p class="text-base text-grey-400">{{ description() }}</p>
      </div>
      <ui-button
        label="Mejorar plan"
        icon="sparkles"
        severity="primary"
        [fluid]="false"
        (click)="goToPlans()"
      />
    </div>
  `,
})
export class PremiumUpgradePromptComponent {
  private readonly router = inject(Router);

  public readonly title = input('Este módulo es premium');
  public readonly description = input(
    'Mejora tu plan para desbloquear esta funcionalidad y sacarle el máximo provecho a tu catálogo.'
  );
  public readonly icon = input('crown');

  protected goToPlans(): void {
    this.router.navigate(['/admin/plans']);
  }
}
