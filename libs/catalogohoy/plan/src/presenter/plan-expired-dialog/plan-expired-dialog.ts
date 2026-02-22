import { Component, inject, ViewChild } from '@angular/core';
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

  @ViewChild(DialogComponent) dialog!: DialogComponent;

  public show(): void {
    this.dialog.show();
  }

  public payPlan(): void {
    const planName = this.planStore.currentPlan()?.name ?? 'mi plan';
    const message = encodeURIComponent(
      `Hola, quiero pagar mi plan ${planName}`
    );
    window.open(`https://wa.me/584124807708?text=${message}`, '_blank');
  }

  public upgradePlan(): void {
    const message = encodeURIComponent(
      'Hola, quiero mejorar mi plan a uno superior'
    );
    window.open(`https://wa.me/584124807708?text=${message}`, '_blank');
  }
}
