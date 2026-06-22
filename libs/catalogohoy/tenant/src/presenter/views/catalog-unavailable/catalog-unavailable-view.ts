import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { ButtonComponent } from '@ui';

/**
 * Shown by the slug guard when a catalog can't be opened. Two states:
 *  - not-found: the tenant slug genuinely doesn't exist.
 *  - error: the existence check failed (e.g. an aborted RPC) — offer a retry
 *    and surface the detail instead of bouncing the user to the landing.
 */
@Component({
  selector: 'lib-catalog-unavailable-view',
  standalone: true,
  imports: [LucideAngularModule, ButtonComponent],
  templateUrl: './catalog-unavailable-view.html',
  host: { class: 'flex items-center justify-center p-6 min-h-dvh bg-grey-25' },
})
export class CatalogUnavailableView {
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.queryParamMap, {
    requireSync: true,
  });

  protected readonly isError = computed(
    () => this.params()?.get('reason') === 'error'
  );
  protected readonly slug = computed(() => this.params()?.get('slug') ?? '');
  protected readonly detail = computed(() => this.params()?.get('detail') ?? '');

  protected retry(): void {
    window.location.reload();
  }

  protected goHome(): void {
    window.location.href = 'https://catalogohoy.com';
  }
}
