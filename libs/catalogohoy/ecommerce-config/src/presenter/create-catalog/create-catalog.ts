import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { PlanStore } from '@catalogohoy/plan';
import { IconComponent } from '@ui';
import { TenantService } from '@catalogohoy/tenant';

const WHATSAPP_NUMBER = '584124807708';

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
  private slugManuallyEdited = false;

  public readonly isLoading = this.planStore.isLoading;
  public readonly canCreate = this.planStore.canCreateCatalog;

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

    if (!this.slugManuallyEdited) {
      const generated = this.toSlug(value);
      this.slug.set(generated);
      if (generated.length > 0) {
        this.checkSlugAvailability(generated);
      } else {
        this.slugStatus.set('idle');
      }
    }
  }

  public onSlugChange(event: Event): void {
    this.slugManuallyEdited = true;
    const raw = (event.target as HTMLInputElement).value;
    const value = this.toSlug(raw);
    this.slug.set(value);

    if (value.length === 0) {
      this.slugStatus.set('idle');
      return;
    }

    this.checkSlugAvailability(value);
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

  public openWhatsApp(): void {
    const message = encodeURIComponent(
      'Hola, me interesa adquirir un catálogo adicional en CatálogoHoy. ¿Me pueden dar más información?'
    );
    const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${message}`;
    window.open(url, '_blank');
  }

  private checkSlugAvailability(slug: string): void {
    if (this.slugCheckTimeout) {
      clearTimeout(this.slugCheckTimeout);
    }

    this.slugStatus.set('checking');

    this.slugCheckTimeout = setTimeout(async () => {
      const exists = await this.tenantService.isValidSlug(slug);
      // isValidSlug returns true if the slug exists (tenant_exists_by_slug)
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
