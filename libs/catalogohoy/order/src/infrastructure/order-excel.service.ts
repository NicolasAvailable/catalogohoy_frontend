import { Injectable } from '@angular/core';
import { E } from '@shared/domain';
import * as XLSX from 'xlsx';
import {
  Order,
  OrderExcelClient,
  OrderExcelLine,
  OrderExcelParseResult,
  OrderStatus,
} from '../domain';

const STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Pendiente',
  completed: 'Completada',
  cancelled: 'Cancelada',
  credit: 'A crédito',
};

@Injectable({ providedIn: 'root' })
export class OrderExcelService {
  /** Exporta una lista de órdenes a un `.xlsx` (una fila por orden). Los
   *  productos se concatenan como "2x Nombre | 1x Otro". `currencySymbol` es la
   *  moneda de referencia del catálogo (encabezado de la columna Total). */
  exportOrders(orders: Order[], currencySymbol: string): E.Either<Error, void> {
    try {
      const rows = orders.map((o) => ({
        'N°': o.orderNumber ?? o.id,
        Fecha: o.createdAt
          ? new Date(o.createdAt).toLocaleDateString('es-VE')
          : '',
        Cliente: o.name,
        Teléfono: o.phone ?? '',
        Estado: STATUS_LABELS[o.status] ?? o.status,
        Productos: o.products.map((p) => `${p.quantity}x ${p.name}`).join(' | '),
        'Método de pago': o.paymentMethod ?? '',
        Envío: o.shippingMethod?.name ?? '',
        [`Total (${currencySymbol})`]: o.totalUsd,
        'Total Bs': o.totalBs ?? '',
      }));

      const worksheet = XLSX.utils.json_to_sheet(rows);
      // Ancho de columnas acotado para que "Productos" largo no explote la hoja.
      worksheet['!cols'] = Object.keys(rows[0] ?? {}).map((key) => ({
        wch: Math.min(
          50,
          Math.max(
            key.length,
            ...rows.map(
              (r) => String((r as Record<string, unknown>)[key] ?? '').length
            )
          ) + 2
        ),
      }));

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Órdenes');
      XLSX.writeFile(
        workbook,
        `ordenes_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
      return E.right(undefined);
    } catch {
      return E.left(new Error('Error al exportar las órdenes'));
    }
  }

  // ── Import de pedido desde Excel ─────────────────────────────────────────
  private static readonly HEADER_KEYWORDS = [
    'cod', 'codigo', 'sku', 'ref', 'referencia', 'descripcion', 'description',
    'producto', 'articulo', 'nombre', 'detalle', 'precio', 'price', 'valor',
    'pedido', 'cantidad', 'cant', 'qty', 'stock', 'total',
  ];

  /** Lee un Excel de pedido de formato libre (preámbulo + encabezado + filas):
   *  detecta la fila de columnas saltando el preámbulo, mapea COD/SKU,
   *  DESCRIPCION/nombre, PRECIO y PEDIDO/cantidad por heurística, y devuelve las
   *  líneas con cantidad > 0 + los datos del cliente si el encabezado los trae. */
  parseOrderExcel(file: File): Promise<E.Either<Error, OrderExcelParseResult>> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, { type: 'array' });
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(sheet, {
            header: 1,
            defval: '',
          }) as unknown[][];

          const headerRow = this.detectHeaderRow(rows);
          if (headerRow < 0) {
            resolve(E.left(new Error('No pude identificar las columnas. Necesito al menos una de producto/descripción y una de cantidad/pedido.')));
            return;
          }
          const headers = (rows[headerRow] || []).map((h) => String(h ?? ''));
          const cols = this.mapColumns(headers);
          if (cols.name < 0 || cols.quantity < 0) {
            resolve(E.left(new Error('El archivo necesita una columna de producto y una de cantidad/pedido.')));
            return;
          }

          const client = this.parseClient(rows, headerRow);
          const lines: OrderExcelLine[] = [];
          let totalRows = 0;
          for (let i = headerRow + 1; i < rows.length; i++) {
            const row = rows[i] || [];
            const name = String(row[cols.name] ?? '').trim();
            if (name) totalRows++;
            const qty = this.toNumber(row[cols.quantity]);
            if (!qty || qty <= 0 || !name) continue;
            lines.push({
              sku: cols.sku >= 0 ? String(row[cols.sku] ?? '').trim() : '',
              name,
              price: cols.price >= 0 ? this.toNumber(row[cols.price]) : 0,
              quantity: qty,
            });
          }
          if (lines.length === 0) {
            resolve(E.left(new Error('No encontré ninguna línea con cantidad (PEDIDO) mayor a 0.')));
            return;
          }
          resolve(E.right({ client, lines, totalRows }));
        } catch {
          resolve(E.left(new Error('Error al leer el archivo. Asegurate de que sea un .xlsx válido.')));
        }
      };
      reader.onerror = () => resolve(E.left(new Error('Error al leer el archivo')));
      reader.readAsArrayBuffer(file);
    });
  }

  private norm(s: unknown): string {
    return String(s ?? '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .trim();
  }

  private detectHeaderRow(rows: unknown[][]): number {
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < Math.min(rows.length, 40); i++) {
      const cells = (rows[i] || []).map((c) => this.norm(c));
      let score = 0;
      for (const c of cells) {
        if (c && OrderExcelService.HEADER_KEYWORDS.some((k) => c === k || c.includes(k))) {
          score++;
        }
      }
      const hasName = cells.some((c) => /descripcion|nombre|producto|articulo|detalle/.test(c));
      const hasPriceOrQty = cells.some((c) => /precio|valor|price|pedido|cantidad|cant|qty/.test(c));
      if (score >= 2 && hasName && hasPriceOrQty && score > bestScore) {
        best = i;
        bestScore = score;
      }
    }
    return best;
  }

  private mapColumns(headers: string[]): {
    sku: number;
    name: number;
    price: number;
    quantity: number;
  } {
    const h = headers.map((raw, idx) => ({ idx, n: this.norm(raw) }));
    const find = (re: RegExp, avoid?: RegExp): number =>
      h.find((c) => c.n && re.test(c.n) && !(avoid && avoid.test(c.n)))?.idx ?? -1;
    // "PEDIDO" (lo que el cliente pide) manda por sobre "CANTIDAD" (que en
    // muchas listas es el stock disponible). Solo si no hay una columna de
    // pedido explícita, cae a cantidad/qty (evitando stock/disponible/total).
    const pedido = find(/pedido|solicitad|a pedir/);
    return {
      sku: find(/\b(cod|codigo|sku|ref|referencia)\b|^cod/),
      name: find(/descripcion|nombre|producto|articulo|detalle/),
      price: find(/precio|valor|price/, /contado|descuento|dcto|dcsto|total|promo/),
      quantity:
        pedido >= 0
          ? pedido
          : find(/cantidad|\bcant\b|qty|unidades/, /stock|disponible|existencia|total/),
    };
  }

  /** Parsea un número tolerando separadores de miles y decimales de cualquier
   *  locale ("1.234,56" VE/ES · "1,234.56" US · "45.000" COP miles · "1,5").
   *  Heurística: el ÚLTIMO separador es decimal solo si le siguen 1-2 dígitos;
   *  si le siguen 3 (o hay más de uno) son todos de miles y se descartan. */
  private toNumber(v: unknown): number {
    let s = String(v ?? '').replace(/[^0-9.,\-]/g, '');
    if (!s) return 0;
    const lastSep = Math.max(s.lastIndexOf('.'), s.lastIndexOf(','));
    if (lastSep >= 0) {
      const decimals = s.length - lastSep - 1;
      if (decimals === 1 || decimals === 2) {
        // Último separador = decimal; el resto (miles) se quita.
        s = s.slice(0, lastSep).replace(/[.,]/g, '') + '.' + s.slice(lastSep + 1);
      } else {
        // Todos son separadores de miles (ej. "45.000") → se descartan.
        s = s.replace(/[.,]/g, '');
      }
    }
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  private parseClient(rows: unknown[][], headerRow: number): OrderExcelClient {
    const info: OrderExcelClient = {};
    const labels: [keyof OrderExcelClient, RegExp][] = [
      ['name', /cliente|nombre/],
      ['doc', /ci|rif|cedula|documento/],
      ['address', /direccion|domicilio/],
      ['phone', /telf|telefono|\btel\b|celular/],
    ];
    const clean = (s: string) =>
      s
        .replace(/por favor,?\s*rellene/i, '')
        .replace(/rellene/i, '')
        .trim();
    for (let i = 0; i < headerRow; i++) {
      const row = rows[i] || [];
      for (let c = 0; c < row.length; c++) {
        const raw = String(row[c] ?? '');
        const n = this.norm(raw);
        for (const [key, re] of labels) {
          if (!re.test(n) || info[key]) continue;
          // Valor en la MISMA celda ("Etiqueta: valor")…
          let val = raw.includes(':') ? clean(raw.split(':').slice(1).join(':')) : '';
          // …o en la(s) celda(s) siguiente(s) de la fila (etiqueta y valor
          // separados), salteando celdas que son OTRA etiqueta.
          for (let k = c + 1; k < row.length && !val; k++) {
            const cellRaw = String(row[k] ?? '');
            const cellNorm = this.norm(cellRaw);
            if (
              !cellNorm ||
              cellRaw.includes(':') ||
              labels.some(([, r]) => r.test(cellNorm))
            ) {
              continue;
            }
            val = clean(cellRaw);
          }
          if (val) info[key] = val;
        }
      }
    }
    return info;
  }
}
