import { Component, inject, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, DialogComponent, IconComponent } from '@ui';
import { PlanStore } from '../../infrastructure';

@Component({
  selector: 'lib-plan-expired-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, IconComponent],
  template: `
    <ui-dialog
      [closable]="false"
      [dismissableMask]="false"
      [closeOnEscape]="false"
      styleClass="max-w-md w-full"
    >
      <div class="flex flex-col items-center text-center gap-4 p-2">
        <div
          class="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center"
        >
          <ui-icon name="circle-alert" styleClass="size-8 text-red-500" />
        </div>

        <h3 class="text-lg font-bold text-grey-700">Tu plan ha expirado</h3>

        <p class="text-grey-300 text-sm">
          Tu plan
          <strong class="text-grey-700">{{
            planStore.currentPlan()?.name
          }}</strong>
          ha vencido. Para continuar usando el panel de administración, renueva o
          mejora tu plan.
        </p>

        <div class="flex flex-col gap-2 w-full mt-2">
          <ui-button
            label="Pagar mi plan"
            icon="credit-card"
            (click)="payPlan()"
            [fluid]="true"
          />
          <ui-button
            label="Mejorar plan"
            icon="crown"
            variant="outlined"
            (click)="upgradePlan()"
            [fluid]="true"
          />
        </div>
      </div>
    </ui-dialog>
  `,
})
export class PlanExpiredDialogComponent {
  public readonly planStore = inject(PlanStore);
  private readonly router = inject(Router);

  @ViewChild(DialogComponent) dialog!: DialogComponent;

  public show(): void {
    this.dialog.show();
  }

  public payPlan(): void {
    // Renovar el MISMO plan: vamos directo al checkout. La lista de planes
    // deshabilita el botón del plan actual, así que navegar a /admin/plans no
    // sirve para re-pagarlo. El edge function manda previous_subscription_id →
    // el webhook extiende el plan y cancela la suscripción anterior. Los de
    // pago manual (VE, sin Stripe) siguen yendo a WhatsApp.
    const planId = this.planStore.currentPlan()?.id;
    if (this.hasStripeHistory() && planId && planId !== 'gratis') {
      this.dialog.hide();
      this.router.navigate(['/admin/plans/checkout', planId], {
        queryParams: { period: 'monthly' },
      });
      return;
    }
    const planName = this.planStore.currentPlan()?.name ?? 'mi plan';
    const message = encodeURIComponent(
      `Hola, quiero pagar mi plan ${planName}`
    );
    window.open(`https://wa.me/584220240947?text=${message}`, '_blank');
  }

  public upgradePlan(): void {
    if (this.hasStripeHistory()) {
      this.goToCheckout();
      return;
    }
    const message = encodeURIComponent(
      'Hola, quiero mejorar mi plan a uno superior'
    );
    window.open(`https://wa.me/584220240947?text=${message}`, '_blank');
  }

  /** Stripe users land on the plans page where they can pick a tier and run
   *  through the existing Stripe Checkout flow — that's where the pending
   *  invoice / re-subscription is handled. Manual-payment users (mostly VE)
   *  keep going to WhatsApp because their billing happens off-platform. */
  private hasStripeHistory(): boolean {
    return this.planStore.tenantPlanUsage()?.hasStripeSubscription ?? false;
  }

  private goToCheckout(): void {
    this.dialog.hide();
    this.router.navigate(['/admin/plans']);
  }
}
