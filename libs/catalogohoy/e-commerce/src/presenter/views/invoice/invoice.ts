import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { Order, OrderPdfService } from '@catalogohoy/order';
import { IconComponent } from '@ui';
import { PublicOrder } from '../../../domain';
import { EcommerceService, EcommerceStore } from '../../../infrastructure';
import { TenantPricePipe } from '../../pipes/tenant-price.pipe';

@Component({
  selector: 'lib-invoice',
  imports: [DecimalPipe, DatePipe, IconComponent, TenantPricePipe, TranslocoPipe],
  templateUrl: './invoice.html',
  styleUrl: './invoice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Invoice {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(EcommerceService);
  private readonly orderPdf = inject(OrderPdfService);
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cs = this.ecommerceStore.currencySymbol;

  public readonly order = signal<PublicOrder | null>(null);
  public readonly isLoading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly isGeneratingPdf = signal(false);

  public readonly info = this.ecommerceStore.effectiveCatalogInfo;

  /** Display number — the per-tenant #N (same as the admin receipt), falling
   *  back to the global id only if the order has no number yet. */
  public readonly displayNumber = computed(() => {
    const o = this.order();
    return o ? o.orderNumber ?? o.id : null;
  });

  public readonly subtotal = computed(() => {
    const o = this.order();
    if (!o) return 0;
    return o.products.reduce((sum, p) => sum + p.total, 0);
  });

  public readonly showBs = computed(
    () => this.ecommerceStore.isVenezuela() && (this.order()?.totalBs ?? 0) > 0
  );

  constructor() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (!id) {
      this.error.set('Pedido no válido');
      this.isLoading.set(false);
      return;
    }
    this.service.getPublicOrder(id).then((result) => {
      result.fold(
        () => this.error.set('No se encontró el pedido'),
        (order) => this.order.set(order)
      );
      this.isLoading.set(false);
    });
  }

  /** Real back navigation (returns to the checkout "sent" screen, etc.); falls
   *  back to the store root when the invoice was opened directly. */
  goBack() {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.router.navigate(['/'], { queryParamsHandling: 'preserve' });
    }
  }

  backToStore() {
    this.router.navigate(['/'], { queryParamsHandling: 'preserve' });
  }

  print() {
    window.print();
  }

  /** Generate the exact same PDF the admin "Descargar recibo" produces, by
   *  reusing OrderPdfService with a context built from the public catalog. */
  async downloadPdf() {
    const o = this.order();
    if (!o || this.isGeneratingPdf()) return;
    this.isGeneratingPdf.set(true);
    try {
      const info = this.info();
      await this.orderPdf.download(this.toOrder(o), {
        storeName: info?.name ?? 'Catálogo',
        currencySymbol: this.cs(),
        showDualBs: this.showBs(),
        logoUrl: info?.logo ?? null,
      });
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  /** Adapt the invoice-safe PublicOrder into the admin Order the PDF expects. */
  private toOrder(o: PublicOrder): Order {
    const createdDate = (o.createdAt || '').slice(0, 10); // YYYY-MM-DD
    return {
      id: o.id,
      orderNumber: o.orderNumber ?? undefined,
      name: o.name,
      products: o.products.map((p) => ({
        productId: p.productId ?? '',
        name: p.name,
        price: p.price,
        quantity: p.quantity,
        total: p.total,
        photo: p.photo,
        sku: p.sku ?? null,
        size: p.size ?? null,
        addons: p.addons ?? null,
      })),
      status: (o.status as Order['status']) ?? 'pending',
      tenantId: Number(this.info()?.id) || 0,
      totalUsd: o.totalUsd,
      totalBs: o.totalBs ?? 0,
      createdAt: o.createdAt,
      updatedAt: o.createdAt,
      phone: o.phone ?? undefined,
      email: o.email ?? undefined,
      comments: o.comments ?? undefined,
      paymentMethod: o.paymentMethod ?? undefined,
      shippingMethod: o.shippingMethod
        ? {
            name: o.shippingMethod.name,
            type: o.shippingMethod.type as 'pickup' | 'delivery' | 'shipping',
            fee: o.shippingMethod.fee,
          }
        : null,
      shippingAddress: o.shippingAddress,
      shippingFee: o.shippingFee,
      deliveryDate: createdDate,
    };
  }
}
