import { Component, computed, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { PlanStore } from '../../infrastructure/plan.store';

@Component({
  selector: 'lib-expiration-banner',
  imports: [LucideAngularModule],
  template: `
    @if (showBanner() && !dismissed()) {
    <div class="expiration-banner" [class.expiration-banner--grace]="isGrace()">
      <div class="expiration-banner__content">
        <div class="expiration-banner__text">
          @if (isGrace()) {
          <span>
            ⚠️ Tu plan <strong>{{ planName() }}</strong> venció.
            @if (graceDays() <= 1) {
            Renuévalo <strong>hoy</strong> para no pasar al plan Gratis.
            } @else {
            Tenés <strong>{{ graceDays() }} días</strong> para renovar antes de
            pasar al plan Gratis.
            }
          </span>
          } @else {
          <span>
            ⏳ Tu plan <strong>{{ planName() }}</strong> vence
            @if (days() === 0) {
            <strong>hoy</strong>
            } @else if (days() === 1) { en <strong>1 día</strong> } @else { en
            <strong>{{ days() }} días</strong>
            }
          </span>
          }
        </div>
        <div class="expiration-banner__actions">
          <button class="expiration-banner__cta" (click)="renewPlan()">
            Renovar plan
          </button>
          <button class="expiration-banner__close" (click)="dismiss()">
            <lucide-angular name="x" [size]="16" />
          </button>
        </div>
      </div>
    </div>
    }
  `,
  styles: `
    .expiration-banner {
      background: #ec5f5f;
      color: white;
      z-index: 40;
      flex-shrink: 0;
    }

    .expiration-banner--grace {
      background: #dc2626;
    }

    .expiration-banner__content {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      padding: 0.75rem 1.5rem;
    }

    .expiration-banner__text {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      font-size: 0.875rem;
      font-weight: 500;
    }

    .expiration-banner__icon {
      flex-shrink: 0;
    }

    .expiration-banner__actions {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-shrink: 0;
    }

    .expiration-banner__cta {
      background: white;
      color: #ec5f5f;
      border: none;
      border-radius: 0.375rem;
      padding: 0.375rem 1rem;
      font-size: 0.8125rem;
      font-weight: 700;
      cursor: pointer;
      white-space: nowrap;
      transition: background 0.2s;
    }

    .expiration-banner__cta:hover {
      background: #fef2f2;
    }

    .expiration-banner__close {
      background: none;
      border: none;
      color: white;
      cursor: pointer;
      opacity: 0.7;
      display: flex;
      align-items: center;
      padding: 0.25rem;
      transition: opacity 0.2s;
    }

    .expiration-banner__close:hover {
      opacity: 1;
    }

    @media (max-width: 640px) {
      .expiration-banner {
        position: fixed;
        top: 0.5rem;
        left: 0.75rem;
        right: 0.75rem;
        border-radius: 0.5rem;
      }

      .expiration-banner__content {
        padding: 0.625rem 1rem;
      }

      .expiration-banner__cta {
        padding: 0.375rem 0.875rem;
        font-size: 0.8125rem;
      }

      .expiration-banner__close {
        padding: 0.25rem;
      }

      .expiration-banner__text {
        font-size: 0.75rem;
      }
    }
  `,
})
export class ExpirationBannerComponent {
  private static readonly DISMISS_KEY = 'expiration_banner_dismissed_at';

  private readonly _planStore = inject(PlanStore);
  public readonly dismissed = signal(this.isDismissedRecently());

  public readonly isGrace = computed(() => this._planStore.inGracePeriod());
  public readonly showBanner = computed(
    () => this._planStore.showExpirationBanner() || this.isGrace()
  );
  public readonly planName = computed(() => this._planStore.currentPlan()?.name ?? '');
  public readonly days = computed(
    () => this._planStore.daysUntilExpiration() ?? 0
  );
  public readonly graceDays = computed(() => this._planStore.graceDaysLeft());

  public dismiss(): void {
    localStorage.setItem(
      ExpirationBannerComponent.DISMISS_KEY,
      new Date().toISOString()
    );
    this.dismissed.set(true);
  }

  private isDismissedRecently(): boolean {
    const dismissedAt = localStorage.getItem(
      ExpirationBannerComponent.DISMISS_KEY
    );
    if (!dismissedAt) return false;
    const diff = Date.now() - new Date(dismissedAt).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    return diff < oneDayMs;
  }

  public renewPlan(): void {
    const planName = this.planName() || 'mi plan';
    const message = encodeURIComponent(
      `Hola, quiero renovar mi plan ${planName} en CatalogoHoy.`
    );
    window.open(`https://wa.me/584220240947?text=${message}`, '_blank');
  }
}
