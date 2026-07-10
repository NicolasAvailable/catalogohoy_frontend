import { Component, inject } from '@angular/core';
import { AppVersionService } from '@catalogohoy/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';

/** Banner fijo abajo a la izquierda cuando hay un deploy nuevo en prod.
 *  La detección vive en AppVersionService (poll del index.html). */
@Component({
  selector: 'app-update-banner',
  imports: [IconComponent, TranslocoPipe],
  templateUrl: './update-banner.html',
  styleUrl: './update-banner.css',
})
export class UpdateBanner {
  public readonly version = inject(AppVersionService);

  constructor() {
    this.version.startWatching();
  }
}
