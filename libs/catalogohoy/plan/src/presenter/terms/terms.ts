import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';

@Component({
  selector: 'lib-terms',
  imports: [IconComponent, TranslocoPipe],
  templateUrl: './terms.html',
  styleUrl: './terms.css',
})
export class Terms {
  public readonly effectiveDate = '1 de marzo de 2026';

  public downloadPdf(): void {
    window.print();
  }
}
