import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { CATALOG_ADDON_PRICE, PlanStore } from '@catalogohoy/plan';
import { TenantService } from '@catalogohoy/tenant';
import { TeamPermissionsStore } from '@catalogohoy/teams';
import { IconComponent } from '@ui';

type SlugStatus = 'idle' | 'checking' | 'available' | 'taken';

@Component({
  selector: 'lib-create-catalog',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './create-catalog.html',
  styleUrl: './create-catalog.css',
  host: {
    class: 'flex-1 flex flex-col min-h-0',
  },
})
export class CreateCatalog implements OnInit {
  private readonly planStore = inject(PlanStore);
  private readonly tenantService = inject(TenantService);
  private readonly permissionsStore = inject(TeamPermissionsStore);
  private readonly router = inject(Router);

  public readonly name = signal('');
  public readonly slug = signal('');
  public readonly slugStatus = signal<SlugStatus>('idle');
  public readonly isSubmitting = signal(false);

  public readonly isLoading = this.planStore.isLoading;
  // Team members (non-owners) always get to create their own catalog for free;
  // only the owner of the current tenant is subject to plan slot limits.
  public readonly canCreate = computed(() =>
    !this.permissionsStore.isOwner() || this.planStore.canCreateCatalog()
  );

  // Catalog slots purchase
  public readonly addonQty = signal(1);
  public readonly isAddingSlots = signal(false);
  public readonly addSlotsError = signal<string | null>(null);
  public readonly addSlotsSuccess = signal(false);

  // Single source of truth — same constant the plans + checkout pages use.
  public readonly catalogAddonPrice = CATALOG_ADDON_PRICE;

  // The "buy more slots" flow goes through `update-catalog-slots`, which
  // pokes Stripe to add a line item to the existing subscription. Free-plan
  // users have no Stripe subscription, so the function 404s. Gate the UI so
  // those users see "necesitas un plan activo" and get routed to /plans.
  public readonly hasActivePlan = computed(
    () =>
      !!this.planStore.currentPlan() &&
      !this.planStore.isPlanExpired() &&
      !this.planStore.isFreePlan()
  );

  public readonly currentCatalogCount = this.planStore.currentCatalogCount;
  public readonly maxCatalogs = this.planStore.maxCatalogs;
  public readonly extraCatalogs = this.planStore.extraCatalogs;

  public readonly totalSlots = computed(
    () => this.maxCatalogs() + this.extraCatalogs()
  );

  public readonly addonCost = computed(
    () => Math.round(this.catalogAddonPrice * this.addonQty() * 100) / 100
  );

  private slugCheckTimeout: ReturnType<typeof setTimeout> | null = null;

  public readonly canSubmit = computed(
    () =>
      this.name().trim().length > 0 &&
      this.slug().trim().length > 0 &&
      this.slugStatus() === 'available' &&
      !this.isSubmitting()
  );

  ngOnInit(): void {
    this.planStore.loadTenantPlanUsage();
  }

  public onNameChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.name.set(value);

    const generated = this.toSlug(value);
    this.slug.set(generated);

    if (generated.length > 0) {
      this.checkSlugAvailability(generated);
    } else {
      this.slugStatus.set('idle');
    }
  }

  public async onSubmit(): Promise<void> {
    if (!this.canSubmit()) return;

    this.isSubmitting.set(true);

    const result = await this.tenantService.createCatalog(
      this.name().trim(),
      this.slug().trim()
    );

    result
      .mapRight((catalog) => {
        window.location.href = `https://${catalog.slug}.catalogohoy.com/admin`;
      })
      .mapLeft(() => {
        this.isSubmitting.set(false);
      });
  }

  public decreaseAddonQty(): void {
    if (this.addonQty() > 1) {
      this.addonQty.set(this.addonQty() - 1);
    }
  }

  public increaseAddonQty(): void {
    this.addonQty.set(this.addonQty() + 1);
  }

  public async purchaseCatalogSlots(): Promise<void> {
    if (this.isAddingSlots()) return;

    this.isAddingSlots.set(true);
    this.addSlotsError.set(null);

    const error = await this.planStore.addCatalogSlots(this.addonQty());

    if (error) {
      this.addSlotsError.set(error);
      this.isAddingSlots.set(false);
    } else {
      this.addSlotsSuccess.set(true);
      this.isAddingSlots.set(false);
      // Refresh usage so canCreate updates
      await this.planStore.refreshUsage();
    }
  }

  public goToPlans(): void {
    this.router.navigate(['/admin/plans']);
  }

  private checkSlugAvailability(slug: string): void {
    if (this.slugCheckTimeout) {
      clearTimeout(this.slugCheckTimeout);
    }

    this.slugStatus.set('checking');

    this.slugCheckTimeout = setTimeout(async () => {
      const exists = await this.tenantService.isValidSlug(slug);
      this.slugStatus.set(exists ? 'taken' : 'available');
    }, 500);
  }

  private toSlug(value: string): string {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
