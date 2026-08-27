import { inject, Injectable } from '@angular/core';
import {
  EcommerceConfigStore,
  NO_CURRENCY_SYMBOL,
  TenantCurrencyStore,
} from '@catalogohoy/ecommerce-config';
import { TenantStore } from '@catalogohoy/tenant';
import { jsPDF } from 'jspdf';
import { isVentaFeatureEnabled, Order, OrderItem } from '../domain';

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
  /** false = catálogo solo-Bs (precio de referencia oculto): el recibo se
   *  renderiza en bolívares en vez de la moneda de referencia. Default true. */
  showReference?: boolean;
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
      // `''` es un valor válido: el storefront ya mapeó el centinela "sin
      // símbolo" a cadena vacía, así que no debe caer al '$' de fallback.
      cs = context.currencySymbol ?? '$';
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
    // El centinela zero-width "sin símbolo" se normaliza a '' — jsPDF con las
    // fuentes estándar no sabe renderizar U+200B y pintaría un glifo basura.
    if (cs === NO_CURRENCY_SYMBOL) cs = '';

    // Per-línea en Bs derivado del snapshot de la orden (rate = totalBs/totalUsd),
    // para que los montos por línea cuadren con el total guardado. Un catálogo
    // solo-Bs (showReference=false) renderiza todo el recibo en bolívares; el
    // resto mantiene la moneda de referencia.
    const rate =
      order.totalBs && order.totalUsd > 0 ? order.totalBs / order.totalUsd : 0;
    const soloBs = context?.showReference === false && rate > 0;
    // Bolívares en formato es-VE: miles con punto, decimales con coma.
    const fmtBs = (n: number): string => {
      const [ent, dec] = n.toFixed(2).split('.');
      return `${ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
    };
    const money = (amount: number): string =>
      soloBs ? `Bs. ${fmtBs(amount * rate)}` : `${cs}${amount.toFixed(2)}`;
    // Catálogo dual (referencia + Bs): cada línea muestra además su
    // equivalente en bolívares al rate del snapshot de la orden. Solo-Bs ya
    // renderiza todo en Bs vía money(); el resto de países no muestra Bs.
    const showBsPerLine = !soloBs && showDualBs && rate > 0;
    const moneyBs = (amount: number): string => `Bs. ${fmtBs(amount * rate)}`;

    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const pageW = 210;
    const pageH = 297;
    const margin = 25;
    const contentW = pageW - margin * 2;
    const bottom = pageH - margin;
    let y = margin;

    // Salta a una página nueva si lo próximo a dibujar no entra en la actual
    // (órdenes largas: sin esto todo lo que pasaba de ~272mm se dibujaba
    // fuera de la hoja y el PDF salía cortado). `onNewPage` permite repetir
    // encabezados (p.ej. el de la tabla de productos) al continuar.
    const ensureSpace = (needed: number, onNewPage?: () => void): void => {
      if (y + needed <= bottom) return;
      doc.addPage();
      y = margin;
      onNewPage?.();
    };

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

    // Left: title — a completed order is a closed sale, so it renders as a
    // "Recibo de Venta / Nota de Entrega"; pending/cancelled stay as "Orden".
    // Beta cerrada: solo los tenants del allowlist ven el PDF como "Recibo de
    // Venta / Nota de Entrega"; el resto conserva el título "Orden".
    const isReceipt =
      order.status === 'completed' && isVentaFeatureEnabled(order.tenantId);
    const docNoun = isReceipt ? 'Recibo' : 'Orden';
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(28);
    doc.setTextColor(...BLACK);
    doc.text(isReceipt ? 'Recibo de Venta' : 'Orden', margin, y + 8);
    y += 16;

    if (isReceipt) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(...GREY);
      doc.text(
        `Nota de Entrega N° ${order.orderNumber ?? order.id}`,
        margin,
        y + 4
      );
      doc.setTextColor(...BLACK);
      y += 8;
    } else {
      y += 2;
    }

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
    // Receipts show the exact date AND time of the sale (needed for a
    // "nota de entrega"); orders keep the date-only creation label.
    const formatDateTime = (d: Date) =>
      d.toLocaleString('es-VE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

    // delivery_date is "YYYY-MM-DD"; parse as local to avoid UTC shift.
    let deliveryDate: Date | null = null;
    if (order.deliveryDate) {
      const [y, m, d] = order.deliveryDate.split('-').map(Number);
      deliveryDate = new Date(y, m - 1, d);
    }

    const meta: [string, string][] = [
      [isReceipt ? 'Número de recibo' : 'Número de orden', `#${order.orderNumber ?? order.id}`],
      [
        isReceipt ? 'Fecha y hora' : 'Fecha de creación',
        isReceipt ? formatDateTime(createdDate) : formatLong(createdDate),
      ],
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

    // NIT (identificación tributaria) cuando la orden lo trae — dato fiscal
    // que el cliente necesita en el recibo para facturar.
    if (order.nit) {
      doc.text(`NIT: ${order.nit}`, colR, y);
      y += 5;
    }

    y += 8;

    // ── Amount line ───────────────────────────────────────────
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(...BLACK);
    doc.text(
      `${money(order.totalUsd)} — ${docNoun} #${order.orderNumber ?? order.id}`,
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

    // Table header — función porque se repite en cada página en la que la
    // tabla continúa. Deja el estado de fuente listo para las filas (9pt negro).
    const drawTableHeader = (): void => {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text('Descripción', descX, y);
      doc.text('Cant.', qtyX, y);
      doc.text('P. unitario', priceX, y);
      doc.text('Monto', totalX, y, { align: 'right' });
      y += 3;
      doc.setDrawColor(...LIGHT);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
      doc.setTextColor(...BLACK);
      doc.setFontSize(9);
    };
    drawTableHeader();

    for (let i = 0; i < order.products.length; i++) {
      const item: OrderItem = order.products[i];
      const imgData = imageMap.get(i);
      const hasSku = !!item.sku;

      // Sub-líneas bajo el nombre, prolijas y en orden:
      //   1) atributos del producto (variante · talla · tramo) en una línea,
      //   2) cada adicional en su PROPIA línea ("+ Nombre ×N (monto)"),
      //   3) el SKU.
      // El precio unitario ya incluye los adicionales; acá solo se itemizan.
      const attrs = [
        item.variantName,
        item.size ? `Talla ${item.size}` : null,
        item.tierTitle ? `Al mayor: ${item.tierTitle}` : null,
      ].filter(Boolean) as string[];

      const addonLines = (item.addons ?? []).map((a) => {
        const q = a.quantity ?? 1;
        const label = q > 1 ? `${a.name} ×${q}` : a.name;
        const amount = a.price * q;
        return amount > 0
          ? `+ ${label} (${money(amount)})`
          : `+ ${label}`;
      });

      const rawSubLines = [
        attrs.length ? attrs.join(' · ') : null,
        ...addonLines,
        hasSku ? `SKU: ${item.sku}` : null,
      ].filter(Boolean) as string[];

      // Ajusta cada sub-línea al ancho de la columna (medido a 7pt) y las
      // aplana, para que nada se salga ni se trunque a una sola línea.
      doc.setFontSize(7);
      const subLines = rawSubLines.flatMap(
        (l) => doc.splitTextToSize(l, qtyX - descX - 6) as string[]
      );
      doc.setFontSize(9);

      const rowH = Math.max(
        (showBsPerLine ? 12 : 8) + subLines.length * 4,
        imgData ? imgSize + 2 : 0
      );
      // Si la fila no entra en lo que queda de página, sigue en una nueva
      // repitiendo el encabezado de la tabla.
      ensureSpace(rowH + 4, drawTableHeader);
      // Centra el nombre con la imagen solo si no hay sub-líneas; si las hay,
      // alinea arriba para que el bloque de texto no quede desbalanceado.
      const textY =
        y + (imgData && subLines.length === 0 ? imgSize / 2 + 1 : 4);

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

      // Sub-líneas (atributos / adicionales / SKU) bajo el nombre
      if (subLines.length) {
        doc.setFontSize(7);
        doc.setTextColor(...GREY);
        let subY = textY;
        for (const line of subLines) {
          subY += 4;
          doc.text(line, descX, subY);
        }
        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
      }

      doc.text(String(item.quantity), qtyX, textY);
      doc.text(money(item.price), priceX, textY);
      doc.text(money(item.total), totalX, textY, {
        align: 'right',
      });

      // Equivalente en Bs por línea (solo catálogos dual referencia + Bs).
      if (showBsPerLine) {
        doc.setFontSize(7);
        doc.setTextColor(...GREY);
        doc.text(moneyBs(item.price), priceX, textY + 4);
        doc.text(moneyBs(item.total), totalX, textY + 4, { align: 'right' });
        doc.setFontSize(9);
        doc.setTextColor(...BLACK);
      }

      y += rowH;

      // Separator between rows
      doc.setDrawColor(...LIGHT);
      doc.line(margin, y, pageW - margin, y);
      y += 4;
    }

    // ── Totals ────────────────────────────────────────────────
    // El bloque de totales no se parte: si no entra completo, página nueva.
    ensureSpace(24);
    const labelX = margin + contentW - 55;
    const valX = totalX;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text('Subtotal', labelX, y);
    doc.text(money(order.totalUsd), valX, y, {
      align: 'right',
    });
    y += 5;

    // El mirror "Total en Bs." solo en catálogos dual-moneda (referencia + Bs);
    // en un catálogo solo-Bs el total ya sale en bolívares vía money().
    if (!soloBs && showDualBs && order.totalBs && order.totalBs > 0) {
      doc.text('Total en Bs.', labelX, y);
      doc.text(`Bs. ${fmtBs(order.totalBs)}`, valX, y, {
        align: 'right',
      });
      y += 5;
    }

    doc.setFont('helvetica', 'bold');
    doc.text('Total', labelX, y);
    doc.text(money(order.totalUsd), valX, y, {
      align: 'right',
    });
    y += 10;

    // ── Comments ──────────────────────────────────────────────
    if (order.comments) {
      // Que el título "Notas" no quede huérfano al fondo de la página.
      ensureSpace(20);
      doc.setDrawColor(...LIGHT);
      doc.line(margin, y, pageW - margin, y);
      y += 6;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...GREY);
      doc.text(isReceipt ? 'Notas / Garantía:' : 'Notas:', margin, y);
      y += 4;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...BLACK);
      const lines = doc.splitTextToSize(order.comments, contentW) as string[];
      for (const line of lines) {
        ensureSpace(4.5);
        doc.text(line, margin, y);
        y += 4.5;
      }
      y += 6;
    }

    // ── Footer ────────────────────────────────────────────────
    // Anclado al pie de la ÚLTIMA página (con espacio garantizado).
    ensureSpace(12);
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

    doc.save(
      `${isReceipt ? 'recibo' : 'orden'}-${order.orderNumber ?? order.id}.pdf`
    );
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
