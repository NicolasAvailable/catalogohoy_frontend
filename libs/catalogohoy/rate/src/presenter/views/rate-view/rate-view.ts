import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  CheckboxComponent,
  IconComponent,
  InputNumberComponent,
} from '@ui';
import { RateType } from '../../../domain/rate';
import { RateStore } from '../../../infrastructure/rate.store';

@Component({
  selector: 'lib-rate-view',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IconComponent,
    ButtonComponent,
    InputNumberComponent,
    CheckboxComponent,
  ],
  templateUrl: './rate-view.html',
  styleUrl: './rate-view.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RateView implements OnInit {
  public readonly rateStore = inject(RateStore);
  private readonly toastService = inject(ToastService);

  public readonly bcvUsd = computed(() => this.rateStore.rate()?.bcv_usd || 0);
  public readonly bcvEur = computed(() => this.rateStore.rate()?.bcv_eur || 0);
  public readonly customRate = computed(
    () => this.rateStore.rate()?.custom_rate || 0
  );
  public readonly activeRate = computed(
    () => this.rateStore.rate()?.active_rate || 'bcv_usd'
  );

  public tempCustomRate: number | null = null;

  ngOnInit(): void {
    this.rateStore.loadRates().then(() => {
      this.tempCustomRate = this.customRate();
    });
  }

  async setActiveRate(rateType: RateType) {
    const result = await this.rateStore.updateActiveRate(rateType);

    result.fold(
      (error: string) => {
        this.toastService.error(new Exception(error));
      },
      () => {
        this.toastService.success('Tasa activa actualizada');
      }
    );
  }

  async updateCustomRate() {
    if (this.tempCustomRate === null) return;

    const result = await this.rateStore.updateCustomRate(this.tempCustomRate);

    result.fold(
      (error: string) => {
        this.toastService.error(new Exception(error));
      },
      () => {
        this.toastService.success('Tasa actualizada correctamente');
      }
    );
  }
}
