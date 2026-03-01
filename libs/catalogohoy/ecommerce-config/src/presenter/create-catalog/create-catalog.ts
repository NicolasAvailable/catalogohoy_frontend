import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlanStore } from '@catalogohoy/plan';
import { TenantService } from '@catalogohoy/tenant';
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
  private readonly router = inject(Router);

  public readonly name = signal('');
  public readonly slug = signal('');
  public readonly slugStatus = signal<SlugStatus>('idle');
  public readonly isSubmitting = signal(false);

  public readonly isLoading = this.planStore.isLoading;
  public readonly canCreate = this.planStore.canCreateCatalog;

  // Catalog slots purchase
  public readonly addonQty = signal(1);
  public readonly isAddingSlots = signal(false);
  public readonly addSlotsError = signal<string | null>(null);
  public readonly addSlotsSuccess = signal(false);

  public static readonly CATALOG_ADDON_PRICE = 6.99;

  public readonly hasActivePlan = computed(
    () => !!this.planStore.currentPlan() && !this.planStore.isPlanExpired()
  );

  public readonly currentCatalogCount = this.planStore.currentCatalogCount;
  public readonly maxCatalogs = this.planStore.maxCatalogs;
  public readonly extraCatalogs = this.planStore.extraCatalogs;

  public readonly totalSlots = computed(
    () => this.maxCatalogs() + this.extraCatalogs()
  );

  public readonly addonCost = computed(
    () => Math.round(CreateCatalog.CATALOG_ADDON_PRICE * this.addonQty() * 100) / 100
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
      .mapRight(() => {
        this.router.navigate(['/admin']);
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
