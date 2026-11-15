import { Component, computed, inject, input, output, signal, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ToastService } from '@shared/infrastructure';
import {
  ButtonComponent,
  DialogComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  ToggleComponent,
} from '@ui';
import { Seller, SELLER_SLUG_RE, sellerLink, slugify } from '../../../domain';
import { SellerStore } from '../../../infrastructure';

@Component({
  selector: 'lib-seller-form-dialog',
  standalone: true,
  imports: [
    FormsModule,
    DialogComponent,
    InputTextComponent,
    InputNumberComponent,
    ToggleComponent,
    ButtonComponent,
    IconComponent,
    TranslocoPipe,
  ],
  templateUrl: './seller-form-dialog.html',
})
export class SellerFormDialogComponent {
  public readonly store = inject(SellerStore);
  private readonly toast = inject(ToastService);

  @ViewChild(DialogComponent) private dialog!: DialogComponent;

  /** URL pública del catálogo, para previsualizar el link del vendedor. */
  public readonly catalogUrl = input('');
  public readonly saved = output<void>();

  public editing: Seller | null = null;
  public readonly name = signal('');
  public readonly slug = signal('');
  public readonly whatsapp = signal('');
  public readonly email = signal('');
  public readonly commissionPct = signal<number>(10);
  public readonly isActive = signal(true);
  public readonly submitted = signal(false);
  /** Mientras el usuario no toque el link, se arma solo a partir del nombre. */
  private slugTouched = false;

  public readonly slugValid = computed(() => SELLER_SLUG_RE.test(this.slug()));
  public readonly pctValid = computed(() => {
    const v = this.commissionPct();
    return v !== null && v !== undefined && v >= 0 && v <= 100;
  });
  public readonly preview = computed(() => sellerLink(this.catalogUrl(), this.slug() || 'nombre'));

  public open(seller: Seller | null = null): void {
    this.editing = seller;
    this.name.set(seller?.name ?? '');
    this.slug.set(seller?.slug ?? '');
    this.whatsapp.set(seller?.whatsapp ?? '');
    this.email.set(seller?.email ?? '');
    this.commissionPct.set(seller?.commissionPct ?? 10);
    this.isActive.set(seller?.isActive ?? true);
    this.submitted.set(false);
    this.slugTouched = !!seller;
    this.dialog.show();
  }

  public close(): void {
    this.dialog.hide();
  }

  public onNameChange(value: string): void {
    this.name.set(value ?? '');
    if (!this.slugTouched) this.slug.set(slugify(value ?? ''));
  }

  public onSlugChange(value: string): void {
    this.slugTouched = true;
    // Se normaliza mientras escribe (sin acentos ni espacios), pero se deja
    // un guion final para que pueda seguir escribiendo.
    this.slug.set(
      (value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9-]+/g, '-')
        .replace(/^-+/, '')
        .slice(0, 40)
    );
  }

  public async save(): Promise<void> {
    this.submitted.set(true);
    const slug = this.slug().replace(/-+$/g, '');
    this.slug.set(slug);
    if (!this.name().trim() || !SELLER_SLUG_RE.test(slug) || !this.pctValid()) return;

    const error = await this.store.save(
      {
        name: this.name().trim(),
        slug,
        whatsapp: this.whatsapp().trim() || null,
        email: this.email().trim() || null,
        commissionPct: Math.round((this.commissionPct() || 0) * 100) / 100,
        isActive: this.isActive(),
      },
      this.editing?.id
    );
    if (error) {
      this.toast.warning(error);
      return;
    }
    this.toast.success(this.editing ? 'Vendedor actualizado' : 'Vendedor agregado');
    this.saved.emit();
    this.close();
  }
}
