import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ButtonComponent,
  IconComponent,
  InputNumberComponent,
  InputTextComponent,
  SelectComponent,
} from '@ui';
import { toast } from 'ngx-sonner';
import {
  CouponProduct,
  CouponProductPrice,
  CreateCouponInput,
  intervalLabel,
  PromotionCodeRow,
} from './coupons.model';
import { CouponsService } from './coupons.service';

@Component({
  selector: 'app-coupons',
  standalone: true,
  imports: [
    FormsModule,
    DecimalPipe,
    IconComponent,
    ButtonComponent,
    InputTextComponent,
    InputNumberComponent,
    SelectComponent,
  ],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  template: `
    <div class="flex flex-col gap-6 h-full min-h-0 p-1">
      <header class="flex flex-col gap-1 shrink-0">
        <h1 class="text-2xl font-bold text-grey-700">Cupones</h1>
        <p class="text-sm text-grey-400">
          Creá cupones de descuento en Stripe para los planes.
        </p>
      </header>

      <div class="grid grid-cols-1 lg:grid-cols-5 gap-6 flex-1 min-h-0">
        <!-- Form -->
        <div
          class="lg:col-span-2 bg-white border border-grey-100 rounded-xl p-5 flex flex-col gap-4 h-fit"
        >
          <h2 class="text-lg font-bold text-grey-700">Nuevo cupón</h2>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-grey-500">Plan</label>
            <ui-select
              [options]="productOptions()"
              [(ngModel)]="productId"
              (ngModelChange)="onProductChange()"
              optionLabel="label"
              optionValue="value"
              placeholder="Elegí un plan"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-grey-500">Modalidad</label>
            <ui-select
              [options]="modalityOptions()"
              [(ngModel)]="modalityPriceId"
              optionLabel="label"
              optionValue="value"
              placeholder="Todas"
            />
            <span class="text-xs text-grey-400">
              Si elegís una modalidad, el código no se podrá usar en las más
              baratas (se aplica un monto mínimo).
            </span>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-grey-500">Tipo</label>
              <ui-select
                [options]="discountTypeOptions"
                [(ngModel)]="discountType"
                optionLabel="label"
                optionValue="value"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-grey-500">
                {{ discountType() === 'percent' ? 'Descuento (%)' : 'Monto (USD)' }}
              </label>
              <ui-input-number
                [(ngModel)]="discountValue"
                [showButtons]="false"
                [min]="0"
                placeholder="15"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-grey-500">Duración</label>
              <ui-select
                [options]="durationOptions"
                [(ngModel)]="duration"
                optionLabel="label"
                optionValue="value"
              />
            </div>
            @if (duration() === 'repeating') {
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-grey-500">Meses</label>
              <ui-input-number
                [(ngModel)]="durationInMonths"
                [showButtons]="false"
                [min]="1"
                placeholder="3"
              />
            </div>
            }
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-sm font-semibold text-grey-500">Código</label>
            <ui-input-text
              [(ngModel)]="code"
              placeholder="AVANZADOTRIM15"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-grey-500">
                Límite de usos
              </label>
              <ui-input-number
                [(ngModel)]="maxRedemptions"
                [showButtons]="false"
                [min]="1"
                placeholder="Sin límite"
              />
            </div>
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-semibold text-grey-500">
                Expira (opcional)
              </label>
              <input
                type="date"
                [(ngModel)]="expiresAt"
                class="border border-grey-200 rounded-lg px-3 py-2 text-sm text-grey-700 focus:outline-none focus:border-primary-400"
              />
            </div>
          </div>

          <ui-button
            label="Crear cupón"
            icon="ticket-percent"
            [disabled]="!canSubmit() || isCreating()"
            [isLoading]="isCreating()"
            (click)="create()"
          />
        </div>

        <!-- List -->
        <div
          class="lg:col-span-3 bg-white border border-grey-100 rounded-xl flex flex-col min-h-0 overflow-hidden"
        >
          <div class="flex items-center justify-between p-4 border-b border-grey-50">
            <h2 class="text-lg font-bold text-grey-700">Cupones existentes</h2>
            <ui-button
              label="Refrescar"
              icon="refresh-cw"
              variant="outlined"
              severity="contrast"
              size="small"
              [fluid]="false"
              (click)="loadCoupons()"
            />
          </div>

          <div class="overflow-auto flex-1">
            @if (isLoadingList()) {
            <p class="text-sm text-grey-400 p-4">Cargando…</p>
            } @else if (codes().length === 0) {
            <p class="text-sm text-grey-400 p-4">Todavía no hay códigos.</p>
            } @else {
            <table class="w-full text-left text-sm">
              <thead class="sticky top-0 bg-grey-25 text-grey-400 text-xs uppercase">
                <tr>
                  <th class="px-4 py-2 font-bold">Código</th>
                  <th class="px-4 py-2 font-bold">Descuento</th>
                  <th class="px-4 py-2 font-bold text-center">Usos</th>
                  <th class="px-4 py-2 font-bold text-center">Estado</th>
                  <th class="px-4 py-2 font-bold text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                @for (c of codes(); track c.id) {
                <tr class="border-b border-grey-50">
                  <td class="px-4 py-2.5 font-bold text-grey-800">{{ c.code }}</td>
                  <td class="px-4 py-2.5 text-grey-600">
                    {{ discountLabel(c) }}
                    <span class="text-grey-300">· {{ durationLabel(c) }}</span>
                    @if (c.minimumAmount) {
                    <span class="text-grey-300 block text-xs">
                      mín. {{ c.minimumAmount / 100 | number: '1.2-2' }} USD
                    </span>
                    }
                  </td>
                  <td class="px-4 py-2.5 text-center text-grey-600">
                    {{ c.timesRedeemed }}{{ c.maxRedemptions ? '/' + c.maxRedemptions : '' }}
                  </td>
                  <td class="px-4 py-2.5 text-center">
                    <span
                      [class]="
                        'inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ' +
                        (c.active
                          ? 'bg-green-50 text-green-700'
                          : 'bg-grey-100 text-grey-400')
                      "
                    >
                      {{ c.active ? 'Activo' : 'Inactivo' }}
                    </span>
                  </td>
                  <td class="px-4 py-2.5 text-right">
                    @if (c.active) {
                    <button
                      type="button"
                      (click)="deactivate(c)"
                      [disabled]="deactivatingId() === c.id"
                      class="text-red-500 hover:text-red-600 text-xs font-semibold cursor-pointer disabled:opacity-50"
                    >
                      Desactivar
                    </button>
                    } @else {
                    <span class="text-grey-300 text-xs">—</span>
                    }
                  </td>
                </tr>
                }
              </tbody>
            </table>
            }
          </div>
        </div>
      </div>
    </div>
  `,
})
export class Coupons implements OnInit {
  private readonly service = inject(CouponsService);

  private readonly products = signal<CouponProduct[]>([]);
  public readonly codes = signal<PromotionCodeRow[]>([]);
  public readonly isLoadingList = signal(false);
  public readonly isCreating = signal(false);
  public readonly deactivatingId = signal<string | null>(null);

  // Form state
  public readonly productId = signal<string>('');
  public readonly modalityPriceId = signal<string>('');
  public readonly discountType = signal<'percent' | 'amount'>('percent');
  public readonly discountValue = signal<number | null>(null);
  public readonly duration = signal<'once' | 'forever' | 'repeating'>('once');
  public readonly durationInMonths = signal<number | null>(null);
  public readonly code = signal<string>('');
  public readonly maxRedemptions = signal<number | null>(null);
  public readonly expiresAt = signal<string>('');

  public readonly discountTypeOptions = [
    { label: 'Porcentaje', value: 'percent' },
    { label: 'Monto fijo', value: 'amount' },
  ];
  public readonly durationOptions = [
    { label: 'Una vez', value: 'once' },
    { label: 'Siempre', value: 'forever' },
    { label: 'X meses', value: 'repeating' },
  ];

  public readonly productOptions = computed(() =>
    this.products().map((p) => ({ label: p.name, value: p.id }))
  );

  public readonly modalityOptions = computed(() => {
    const p = this.products().find((x) => x.id === this.productId());
    const opts = [{ label: 'Todas las modalidades', value: '' }];
    if (!p) return opts;
    return [
      ...opts,
      ...p.prices.map((pr) => ({
        label: `${intervalLabel(pr)} ($${(pr.unitAmount / 100).toFixed(2)})`,
        value: pr.id,
      })),
    ];
  });

  public readonly canSubmit = computed(
    () => !!this.productId() && (this.discountValue() ?? 0) > 0
  );

  ngOnInit(): void {
    this.loadProducts();
    this.loadCoupons();
  }

  onProductChange(): void {
    this.modalityPriceId.set('');
  }

  private async loadProducts(): Promise<void> {
    const res = await this.service.listProducts();
    res.fold(
      (e) => toast.error(e.message),
      ({ products }) => this.products.set(products)
    );
  }

  async loadCoupons(): Promise<void> {
    this.isLoadingList.set(true);
    const res = await this.service.listCoupons();
    res.fold(
      (e) => toast.error(e.message),
      ({ promotionCodes }) => this.codes.set(promotionCodes)
    );
    this.isLoadingList.set(false);
  }

  private selectedPrice(): CouponProductPrice | undefined {
    const p = this.products().find((x) => x.id === this.productId());
    return p?.prices.find((pr) => pr.id === this.modalityPriceId());
  }

  async create(): Promise<void> {
    if (!this.canSubmit() || this.isCreating()) return;
    this.isCreating.set(true);

    const value = this.discountValue() ?? 0;
    const input: CreateCouponInput = {
      productId: this.productId(),
      duration: this.duration(),
      name: this.code().trim() || undefined,
      code: this.code().trim() || undefined,
    };
    if (this.discountType() === 'percent') input.percentOff = value;
    else input.amountOff = Math.round(value * 100);
    if (this.duration() === 'repeating')
      input.durationInMonths = this.durationInMonths() ?? 1;
    if (this.maxRedemptions()) input.maxRedemptions = this.maxRedemptions()!;
    if (this.expiresAt())
      input.expiresAt = Math.floor(new Date(this.expiresAt()).getTime() / 1000);
    // Pin to the chosen modality via a minimum amount (excludes cheaper ones).
    const price = this.selectedPrice();
    if (price) input.minimumAmount = price.unitAmount;

    const res = await this.service.create(input);
    res.fold(
      (e) => toast.error(e.message),
      () => {
        toast.success('Cupón creado');
        this.code.set('');
        this.discountValue.set(null);
        this.maxRedemptions.set(null);
        this.expiresAt.set('');
        this.loadCoupons();
      }
    );
    this.isCreating.set(false);
  }

  async deactivate(c: PromotionCodeRow): Promise<void> {
    this.deactivatingId.set(c.id);
    const res = await this.service.deactivate(c.id);
    res.fold(
      (e) => toast.error(e.message),
      () => {
        toast.success('Código desactivado');
        this.loadCoupons();
      }
    );
    this.deactivatingId.set(null);
  }

  discountLabel(c: PromotionCodeRow): string {
    if (c.coupon.percentOff) return `${c.coupon.percentOff}% off`;
    if (c.coupon.amountOff) return `$${(c.coupon.amountOff / 100).toFixed(2)} off`;
    return '—';
  }

  durationLabel(c: PromotionCodeRow): string {
    if (c.coupon.duration === 'forever') return 'siempre';
    if (c.coupon.duration === 'repeating')
      return `${c.coupon.durationInMonths} meses`;
    return 'una vez';
  }
}
