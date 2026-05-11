import { Component, inject, ViewChild } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonComponent, DialogComponent, IconComponent } from '@ui';
import { PlanStore } from '../../infrastructure';

@Component({
  selector: 'lib-plan-limit-dialog',
  standalone: true,
  imports: [DialogComponent, ButtonComponent, IconComponent],
  template: `
    <ui-dialog styleClass="max-w-md w-full">
      <div class="flex flex-col items-center text-center gap-4 p-2">
        <div
          class="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center"
        >
          <ui-icon name="triangle-alert" styleClass="size-8 text-amber-500" />
        </div>

        <h3 class="text-lg font-bold">Límite de productos alcanzado</h3>

        <p class="text-grey-300 text-sm">
          Tu plan
          <strong class="text-grey-700">{{
            planStore.currentPlan()?.name
          }}</strong>
          permite un máximo de
          <strong class="text-grey-700">{{
            planStore.maxProducts() > 0 ? planStore.maxProducts() : '∞'
          }}</strong>
          productos. Actualmente tienes
          <strong class="text-grey-700">{{
            planStore.currentProductCount()
          }}</strong
          >.
        </p>

        <p class="text-grey-300 text-sm">
          Mejora tu plan para agregar más productos a tu catálogo.
        </p>

        <div class="flex gap-2 w-full">
          <ui-button
            label="Cerrar"
            variant="outlined"
            severity="contrast"
            (click)="close()"
            [fluid]="true"
          />
          <ui-button
            label="Ver planes"
            icon="crown"
            (click)="goToPlans()"
            [fluid]="true"
          />
        </div>
      </div>
    </ui-dialog>
  `,
})
export class PlanLimitDialogComponent {
  public readonly planStore = inject(PlanStore);
  private readonly router = inject(Router);

  @ViewChild(DialogComponent) dialog!: DialogComponent;

  public show(): void {
    this.dialog.show();
  }

  public close(): void {
    this.dialog.hide();
  }

  public goToPlans(): void {
    this.dialog.hide();
    this.router.navigate(['/admin/plans']);
  }
}
