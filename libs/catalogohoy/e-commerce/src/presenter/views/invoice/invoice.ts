import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { IconComponent } from '@ui';
import { PublicOrder } from '../../../domain';
import { EcommerceService, EcommerceStore } from '../../../infrastructure';

@Component({
  selector: 'lib-invoice',
  imports: [DecimalPipe, DatePipe, IconComponent],
  templateUrl: './invoice.html',
  styleUrl: './invoice.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class Invoice {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(EcommerceService);
  public readonly ecommerceStore = inject(EcommerceStore);
  public readonly cs = this.ecommerceStore.currencySymbol;

  public readonly order = signal<PublicOrder | null>(null);
  public readonly isLoading = signal(true);
  public readonly error = signal<string | null>(null);
  public readonly isGeneratingPdf = signal(false);

  public readonly info = this.ecommerceStore.effectiveCatalogInfo;

  public readonly subtotal = computed(() => {
    const o = this.order();
    if (!o) return 0;
    return o.products.reduce((sum, p) => sum + p.total, 0);
  });

  public readonly showBs = computed(
    () =>
      this.ecommerceStore.isVenezuela() &&
      (this.order()?.totalBs ?? 0) > 0
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

  backToStore() {
    this.router.navigate(['/'], { queryParamsHandling: 'preserve' });
  }

  print() {
    window.print();
  }

  async downloadPdf() {
    const o = this.order();
    if (!o || this.isGeneratingPdf()) return;
    this.isGeneratingPdf.set(true);
    try {
      const { jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });
      const symbol = this.cs();
      const left = 40;
      let y = 56;

      const business = this.info()?.name ?? 'Catálogo';
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(business, left, y);
      y += 22;

      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(110);
      doc.text(`Factura #${o.id}`, left, y);
      doc.text(
        new Date(o.createdAt).toLocaleString('es'),
        left,
        y + 14
      );
      doc.setTextColor(20);
      y += 40;

      doc.setFont('helvetica', 'bold');
      doc.text('Artículos', left, y);
      y += 8;
      doc.setDrawColor(220);
      doc.line(left, y, 555, y);
      y += 16;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      o.products.forEach((p) => {
        const name = `${p.quantity}x ${p.name}${p.size ? ` (${p.size})` : ''}`;
        doc.text(this.truncate(name, 70), left, y);
        doc.text(`${symbol}${p.total}`, 555, y, { align: 'right' });
        y += 16;
      });

      y += 6;
      doc.line(left, y, 555, y);
      y += 18;

      const row = (label: string, value: string, bold = false) => {
        doc.setFont('helvetica', bold ? 'bold' : 'normal');
        doc.text(label, left, y);
        doc.text(value, 555, y, { align: 'right' });
        y += 16;
      };
      row('Subtotal', `${symbol}${this.subtotal()}`);
      if (o.shippingMethod) {
        row(
          o.shippingMethod.name || 'Envío',
          o.shippingFee > 0 ? `${symbol}${o.shippingFee}` : 'Gratis'
        );
      }
      y += 4;
      row('Total', `${symbol}${o.totalUsd}`, true);
      if (this.showBs()) {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(110);
        doc.text(`Bs. ${(o.totalBs ?? 0).toFixed(2)}`, 555, y, {
          align: 'right',
        });
        doc.setTextColor(20);
        y += 16;
      }

      y += 14;
      doc.setFont('helvetica', 'bold');
      doc.text('Detalles del pedido', left, y);
      y += 18;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(10);
      const details: string[] = [];
      details.push(`Cliente: ${o.name}${o.phone ? ` / ${o.phone}` : ''}`);
      if (o.email) details.push(`Correo: ${o.email}`);
      if (o.shippingMethod) {
        details.push(`Envío: ${o.shippingMethod.name}`);
        if (o.shippingAddress) details.push(`Dirección: ${o.shippingAddress}`);
      }
      if (o.paymentMethod) details.push(`Pago: ${o.paymentMethod}`);
      if (o.comments) details.push(`Comentarios: ${o.comments}`);
      details.forEach((d) => {
        const lines = doc.splitTextToSize(d, 515) as string[];
        lines.forEach((ln) => {
          doc.text(ln, left, y);
          y += 14;
        });
      });

      doc.save(`factura-${o.id}.pdf`);
    } finally {
      this.isGeneratingPdf.set(false);
    }
  }

  private truncate(s: string, max: number): string {
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
  }
}
