import { inject, Injectable } from '@angular/core';
import {
  EcommerceConfigStore,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { jsPDF } from 'jspdf';
import { Order, OrderItem } from '../domain';

const PAYMENT_LABELS: Record<string, string> = {
  efectivo: 'Efectivo',
  transferencia: 'Transferencia',
  tarjeta_credito: 'Tarjeta de crédito',
  pago_movil: 'Pago móvil',
  binance: 'Binance',
  zelle: 'Zelle',
  paypal: 'PayPal',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  completed: 'Completada',
  cancelled: 'Cancelada',
};

const BLACK = [0, 0, 0] as const;
const GREY = [120, 120, 120] as const;
const LIGHT = [200, 200, 200] as const;

/** Store/currency context for rendering a receipt outside the admin (e.g. the
 *  public catalog invoice), where the config/tenant/currency stores aren't
 *  populated. Omit to derive everything from those stores (admin path). */
export interface OrderPdfContext {
  storeName: string;
  currencySymbol: string;
  showDualBs: boolean;
  logoUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class OrderPdfService {
  private readonly configStore = inject(EcommerceConfigStore);
  private readonly tenantStore = inject(TenantStore);
  private readonly tenantCurrency = inject(TenantCurrencyStore);

  /**
   * @param order   The order to render.
   * @param context Optional store/currency context. Pass it when the admin
   *   stores aren't available (e.g. the public catalog invoice) so the exact
   *   same receipt can be produced outside the admin. Omit it in the admin and
   *   it derives everything from the config/tenant/currency stores.
   */
  async download(order: Order, context?: OrderPdfContext): Promise<void> {
    let storeName: string;
    let showDualBs: boolean;
    let cs: string;
    let logoUrl: string | null;

    if (context) {
      storeName = context.storeName || 'Catálogo';
      showDualBs = context.showDualBs;
      cs = context.currencySymbol || '$';
      logoUrl = context.logoUrl;
    } else {
      // Ensure the tenant currency is loaded (cache-first — typically a no-op
      // because some view has already primed it, but cheap if not).
      const tenantId = await this.tenantStore.getTenantIdAsync();
      if (tenantId) await this.tenantCurrency.load(tenantId);

      const config = this.configStore.config();
      storeName = config?.name || this.tenantStore.tenantName() || 'Catálogo';
      // Show the bolivar total only for Venezuela-style dual catalogs.
      showDualBs = this.tenantCurrency.showDualCurrency();
      // Symbol: the catalog's reference (display) currency. VE renders its
      // chosen reference (USD '$' or EUR '€') with the Bs. dual shown below;
      // every other country renders its local currency.
      cs = this.tenantCurrency.displaySymbol() || config?.currencySymbol || '$';
      logoUrl = config?.logo ?? null;
    }

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const margin = 25;
    const contentW = pageW - margin * 2;
    let y = margin;

    // ── Try to load logo ──────────────────────────────────────
    let logoData: string | null = null;
    if (logoUrl) {
      try {
        const res = await fetch(logoUrl, { mode: 'cors' });
        const blob = await res.blob();
        logoData = await this.blobToBase64(blob);
      } catch {
        /* logo failed — proceed without */
      }
    }

    // ── Header ────────────────────────────────────────────────
    // Right: Logo
    if (logoData) {
      try {
        doc.addImage(logoData, 'PNG', pageW - margin - 20, y, 20, 20);
      } catch {
        /* unsupported format */
      }
    }

    // Left: "Orden" title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(...BLACK);
    doc.text('Orden', margin, y + 8);
    y += 18;

    // Order metadata
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...BLACK);

    const createdDate = new Date(order.createdAt);
    const formatLong = (d: Date) =>
      d.toLocaleDateString('es-VE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

    // delivery_date is "YYYY-MM-DD"; parse as local to avoid UTC shift.
    let deliveryDate: Date | null = null;
    if (order.deliveryDate) {
      const [y, m, d] = order.deliveryDate.split('-').map(Number);
      deliveryDate = new Date(y, m - 1, d);
    }

    const meta: [string, string][] = [
      ['Número de orden', `#${order.orderNumber ?? order.id}`],
      ['Fecha de creación', formatLong(createdDate)],
      [
        'Fecha de entrega',
        deliveryDate ? formatLong(deliveryDate) : formatLong(createdDate),
      ],
      ['Estado', STATUS_LABELS[order.status] ?? order.status],
    ];
    if (order.paymentMethod) {
      meta.push([
        'Método de pago',
        PAYMENT_LABELS[order.paymentMethod] ?? order.paymentMethod,
      ]);
    }

    for (const [label, value] of meta) {
      doc.setFont('helvetica', 'bold');
      doc.text(label, margin, y);
      doc.setFont('helvetica', 'normal');
      doc.text(value, margin + 40, y);
      y += 5;
    }

    y += 6;

    // ── Two-column: Store info / Customer ──────────────────────
    const colR = margin + contentW / 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text(storeName, margin, y);
    doc.text('Cliente', colR, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GREY);
    doc.text('catalogohoy.com', margin, y);
    doc.setTextColor(...BLACK);
    doc.text(order.name || '—', colR, y);
    y += 5;

    if (order.phone) {
      doc.text(order.phone, colR, y);
      y += 5;
    }

    y += 8;

    // ── Amount line ───────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...BLACK);
    doc.text(
      `${cs}${order.totalUsd.toFixed(2)} — Orden #${order.orderNumber ?? order.id}`,
      margin,
      y
    );
    y += 8;

    // Thin line
    doc.setDrawColor(...LIGHT);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageW - margin, y);
    y += 6;

    // ── Pre-load product images ─────────────────────────────
    const imgSize = 10; // mm
    const imageMap = new Map<number, string>();

    const imagePromises = order.products.map(async (item, idx) => {
      if (!item.photo) return;
      try {
        const res = await fetch(item.photo, { mode: 'cors' });
        const blob = await res.blob();
        const b64 = await this.blobToBase64(blob);
        imageMap.set(idx, b64);
      } catch {
        /* image failed — skip */
      }
    });
    await Promise.all(imagePromises);

    const hasAnyImage = imageMap.size > 0;
    const imgColW = hasAnyImage ? imgSize + 3 : 0;

    // ── Products table ────────────────────────────────────────
    const descX = margin + imgColW;
    const qtyX = margin + contentW - 60;
    const priceX = margin + contentW - 35;
    const totalX = pageW - margin;

    // Table header
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...GREY);
    doc.text('Descripción', descX, y);
    doc.text('Cant.', qtyX, y);
    doc.text('P. unitario', priceX, y);
    doc.text('Monto', totalX, y, { align: 'right' });
    y += 3;

    doc.line(margin, y, pageW - margin, y);
    y += 4;

    // Table rows
    doc.setTextColor(...BLACK);
    doc.setFontSize(9);

    for (let i = 0; i < order.products.length; i++) {
      const item: OrderItem = order.products[i];
      const imgData = imageMap.get(i);
      const hasSku = !!item.sku;
      const addons = (item.addons ?? []).filter((a) => a && a.name);
      // Each addon adds ~4mm of height under the name/SKU block.
      const addonsH = addons.length * 4;
      const rowH = Math.max(
        (hasSku ? 12 : 8) + addonsH,
        imgData ? imgSize + 2 : 0
      );
      const textY = y + (imgData ? imgSize / 2 + 1 : 4);

      // Product image
      if (imgData) {
        try {
          doc.addImage(imgData, 'JPEG', margin, y, imgSize, imgSize);
        } catch {
          /* unsupported format */
        }
      }

      doc.setFont('helvetica', 'normal');

      // Product name
      const nameLines = doc.splitTextToSize(
        item.name,
        qtyX - descX - 6
      ) as string[];
      doc.text(nameLines[0], descX, textY);

      // SKU below name
      let subY = textY;
      if (hasSku) {
        subY += 4;
        doc.setFontSize(7);
        doc.setTextColor(...GREY);
        doc.text(`SKU: ${item.sku}`, descX, subY);
        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
      }

      // Addons (paid extras) itemised under the product.
      if (addons.length) {
        doc.setFontSize(8);
        doc.setTextColor(...GREY);
        for (const a of addons) {
          subY += 4;
          const priceStr = a.price > 0 ? `  (+${cs}${a.price.toFixed(2)})` : '';
          doc.text(`+ ${a.name}${priceStr}`, descX, subY);
        }
        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
      }

      doc.text(String(item.quantity), qtyX, textY);
      doc.text(`${cs}${item.price.toFixed(2)}`, priceX, textY);
      doc.text(`${cs}${item.total.toFixed(2)}`, totalX, textY, {
        align: 'right',
      });

      y += rowH;

      // Separator between rows
      doc.setDrawColor(...LIGHT);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
    }

    // ── Totals ────────────────────────────────────────────────
    const labelX = margin + contentW - 55;
    const valX = totalX;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Subtotal', labelX, y);
    doc.text(`${cs}${order.totalUsd.toFixed(2)}`, valX, y, {
      align: 'right',
    });
    y += 5;

    if (showDualBs && order.totalBs && order.totalBs > 0) {
      doc.text('Total en Bs.', labelX, y);
      doc.text(`Bs. ${order.totalBs.toFixed(2)}`, valX, y, {
        align: 'right',
      });
      y += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Total', labelX, y);
    doc.text(`${cs}${order.totalUsd.toFixed(2)}`, valX, y, {
      align: 'right',
    });
    y += 10;

    // ── Comments ──────────────────────────────────────────────
    if (order.comments) {
      doc.setDrawColor(...LIGHT);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text('Notas:', margin, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...BLACK);
      const lines = doc.splitTextToSize(order.comments, contentW) as string[];
      doc.text(lines, margin, y);
      y += lines.length * 4.5 + 6;
    }

    // ── Footer ────────────────────────────────────────────────
    y = Math.max(y, 260);
    doc.setDrawColor(...LIGHT);
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    doc.setFontSize(7);
    doc.setTextColor(...GREY);
    doc.text(
      `Generado desde ${storeName} · catalogohoy.com`,
      margin,
      y
    );

    doc.save(`orden-${order.orderNumber ?? order.id}.pdf`);
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
}
