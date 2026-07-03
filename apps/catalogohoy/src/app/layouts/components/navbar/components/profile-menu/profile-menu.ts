import { DatePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  output,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthenticationService } from '@catalogohoy/auth';
import { PosthogService } from '@catalogohoy/core';
import { PlanStore } from '@catalogohoy/plan';
import { CreditsStore } from '@catalogohoy/product';
import { ProfileStore } from '@catalogohoy/profile';
import {
  ConfirmDialogService,
  IconComponent,
  MenuComponent,
} from '@ui';

@Component({
  selector: 'app-profile-menu',
  imports: [DatePipe, RouterLink, MenuComponent, IconComponent],
  templateUrl: './profile-menu.html',
  styleUrl: './profile-menu.css',
})
export class ProfileMenu {
  public readonly menu = viewChild<MenuComponent>('profileMenu');
  protected readonly planStore = inject(PlanStore);
  protected readonly palette = this.planStore.currentPlanPalette;
  /** Saldo de créditos de IA (para mostrarlo en el dropdown en móvil). */
  protected readonly credits = inject(CreditsStore);
  /** Datos del usuario (nombre, email, foto) para el bloque de identidad. */
  protected readonly profileStore = inject(ProfileStore);
  private readonly auth = inject(AuthenticationService);
  private readonly posthog = inject(PosthogService);
  private readonly confirm = inject(ConfirmDialogService);
  /** El navbar conecta esto con el diálogo de compra del CreditsWidget. */
  public readonly buyCredits = output<void>();

  protected readonly summary = computed(() => {
    const plan = this.planStore.currentPlan();
    const isFree = this.planStore.isFreePlan();
    const expired = this.planStore.isPlanExpired();
    const days = this.planStore.daysUntilExpiration();
    const expiresAt = this.planStore.planExpiresAt();

    if (!plan) return null;
    if (isFree) {
      return { label: `Plan ${plan.name}`, sub: 'Mejorá tu plan', state: 'free' as const, expiresAt: null };
    }
    if (expired) {
      return { label: `Plan ${plan.name}`, sub: 'Vencido', state: 'expired' as const, expiresAt };
    }
    const sub =
      days === null
        ? 'Activo'
        : days <= 0
          ? 'Vence hoy'
          : days === 1
            ? 'Vence mañana'
            : `Vence en ${days} días`;
    return { label: `Plan ${plan.name}`, sub, state: 'active' as const, expiresAt };
  });

  /** Inicial para el avatar cuando el usuario no tiene foto. */
  protected readonly initial = computed(() => {
    const name = this.profileStore.profile().name?.trim();
    return (name?.[0] ?? '?').toUpperCase();
  });

  public close(): void {
    this.menu()?.hide();
  }

  /** Abre el diálogo de compra (el navbar lo conecta con el CreditsWidget). */
  public onBuyCredits(): void {
    this.close();
    this.buyCredits.emit();
  }

  /** Cierra sesión (mismo flujo que el sidebar: confirma → limpia → redirige). */
  public logout(): void {
    this.close();
    this.confirm
      .warning({
        headerLabel: '¿Cerrar sesión?',
        contentLabel: '¿Estás seguro que deseas cerrar sesión?',
        acceptLabel: 'Cerrar sesión',
        rejectLabel: 'Cancelar',
      })
      .subscribe((result) => {
        if (result.isRight()) {
          this.posthog.reset();
          this.auth.logout().then(() => {
            window.location.href = 'https://auth.catalogohoy.com';
          });
        }
      });
  }
}
