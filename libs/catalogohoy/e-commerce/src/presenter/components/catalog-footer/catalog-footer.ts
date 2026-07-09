import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PlanStore } from '@catalogohoy/plan';
import { TranslocoPipe } from '@jsverse/transloco';
import { EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-catalog-footer',
  imports: [TranslocoPipe],
  templateUrl: './catalog-footer.html',
  styleUrl: './catalog-footer.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CatalogFooter {
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly planStore = inject(PlanStore);

  get currentYear(): number {
    return new Date().getFullYear();
  }
}
