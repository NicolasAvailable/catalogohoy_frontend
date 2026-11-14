import { Product, ProductSize, ProductVariant } from './product.model';

/**
 * Edición masiva de productos (pedido de Distribuidora Moto Fox, CAT-76).
 *
 * Lógica pura (sin Angular) de la grilla tipo Excel: qué filas y columnas hay,
 * cómo se parsean/validan los valores escritos o pegados, y cómo se traducen
 * las celdas modificadas a parches por producto. La vista solo maneja la
 * interacción (selección, teclado, portapapeles).
 */

export type BulkColumnKey =
  | 'name'
  | 'option'
  | 'stock'
  | 'sku'
  | 'price'
  | 'pricePromotional'
  | 'originalPrice'
  | 'productionCost'
  | 'visible'
  | 'soldOut';

export type BulkColumnType = 'text' | 'number' | 'bool';

export interface BulkColumn {
  key: BulkColumnKey;
  label: string;
  type: BulkColumnType;
  width: number;
  /** Explicación corta mostrada como tooltip del encabezado. */
  hint?: string;
}

export const BULK_COLUMNS: readonly BulkColumn[] = [
  { key: 'name', label: 'Nombre', type: 'text', width: 240 },
  { key: 'option', label: 'Variante / talla', type: 'text', width: 160 },
  { key: 'stock', label: 'Inventario', type: 'number', width: 100, hint: 'Vacío = ilimitado' },
  { key: 'sku', label: 'SKU', type: 'text', width: 130 },
  { key: 'price', label: 'Precio', type: 'number', width: 100 },
  {
    key: 'pricePromotional',
    label: 'Precio promocional',
    type: 'number',
    width: 130,
    hint: 'Solo productos. Vacío = sin promoción',
  },
  {
    key: 'originalPrice',
    label: 'Precio original',
    type: 'number',
    width: 120,
    hint: 'Solo variantes: precio tachado. Vacío = ninguno',
  },
  { key: 'productionCost', label: 'Costo', type: 'number', width: 100 },
  { key: 'visible', label: 'Visible', type: 'bool', width: 80 },
  { key: 'soldOut', label: 'Agotado', type: 'bool', width: 80 },
];

export type BulkCellValue = string | boolean;
export type BulkRowValues = Partial<Record<BulkColumnKey, BulkCellValue>>;
/** rowKey → columnas editadas (solo las que difieren del original). */
export type BulkEdits = Map<string, BulkRowValues>;

export type BulkRowKind = 'product' | 'variant' | 'size';

export interface BulkRow {
  /** Clave estable: p:<id> · v:<id>:<variantId> · s:<id>:<variantId|->:<índice>. */
  key: string;
  kind: BulkRowKind;
  productId: string;
  productName: string;
  variantId: string | null;
  sizeIndex: number | null;
  /** Nombre original de la talla (para ubicarla al guardar). */
  sizeName: string | null;
  /** Valores originales. Una columna ausente = no aplica a esta fila. */
  original: BulkRowValues;
  /** Texto normalizado del producto completo (nombre, SKU, variantes, tallas). */
  searchText: string;
}

/** Texto para buscar: minúsculas y sin acentos. */
export const normalizeSearch = (s: string): string =>
  (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

const numToCell = (n: number | string | null | undefined): string => {
  if (n === null || n === undefined || n === '') return '';
  const num = Number(n);
  return Number.isFinite(num) ? String(num) : String(n);
};

/** 0 / null se muestran vacíos (= "sin precio promocional / tachado"). */
const optionalPriceToCell = (n: number | null | undefined): string =>
  !n || Number(n) === 0 ? '' : numToCell(n);

const variantHasOwnStock = (v: ProductVariant) =>
  !v.sizes?.length && v.stock !== null && v.stock !== undefined && (v.stock as unknown) !== '';

/** ¿El stock del producto (columna `products.stock`) es el que realmente se
 *  usa? No cuando maneja tallas (vive en cada talla) ni cuando todas sus
 *  variantes llevan su propio stock (ver totalStockOf). */
export function productStockApplies(p: Product): boolean {
  if (p.isSized && p.sizes?.length) return false;
  const variants = p.isVariant ? p.variants ?? [] : [];
  if (variants.length && variants.every((v) => v.sizes?.length || variantHasOwnStock(v))) {
    return false;
  }
  return true;
}

const sizeRow = (
  p: Product,
  size: ProductSize,
  index: number,
  variantId: string | null,
  searchText: string
): BulkRow => ({
  key: `s:${p.id}:${variantId ?? '-'}:${index}`,
  kind: 'size',
  productId: String(p.id),
  productName: p.name,
  variantId,
  sizeIndex: index,
  sizeName: size.name,
  original: {
    option: size.name ?? '',
    stock: numToCell(size.stock),
    sku: size.sku ?? '',
  },
  searchText,
});

/** Una fila por producto + una por variante + una por talla (debajo de su
 *  producto o variante), en el mismo orden del listado. */
export function buildBulkRows(products: Product[]): BulkRow[] {
  const rows: BulkRow[] = [];
  for (const p of products) {
    const id = String(p.id);
    const variants = p.isVariant ? p.variants ?? [] : [];
    const sizes = p.isSized ? p.sizes ?? [] : [];
    const searchText = normalizeSearch(
      [
        p.name,
        p.sku,
        ...sizes.flatMap((s) => [s.name, s.sku]),
        ...variants.flatMap((v) => [v.name, v.sku, ...(v.sizes ?? []).flatMap((s) => [s.name, s.sku])]),
      ]
        .filter(Boolean)
        .join(' ')
    );

    const original: BulkRowValues = {
      name: p.name ?? '',
      sku: p.sku ?? '',
      price: numToCell(p.price ?? 0),
      pricePromotional: optionalPriceToCell(p.pricePromotional),
      productionCost: numToCell(p.productionCost),
      visible: !p.isHidden,
      soldOut: !!p.isSoldOut,
    };
    if (productStockApplies(p)) original.stock = numToCell(p.stock);

    rows.push({
      key: `p:${id}`,
      kind: 'product',
      productId: id,
      productName: p.name,
      variantId: null,
      sizeIndex: null,
      sizeName: null,
      original,
      searchText,
    });

    sizes.forEach((s, i) => rows.push(sizeRow(p, s, i, null, searchText)));

    for (const v of variants) {
      const vOriginal: BulkRowValues = {
        option: v.name ?? '',
        sku: v.sku ?? '',
        price: numToCell(v.price ?? 0),
        originalPrice: optionalPriceToCell(v.originalPrice),
        visible: !v.isHidden,
      };
      if (!v.sizes?.length) vOriginal.stock = numToCell(v.stock);
      rows.push({
        key: `v:${id}:${v.id}`,
        kind: 'variant',
        productId: id,
        productName: p.name,
        variantId: v.id,
        sizeIndex: null,
        sizeName: null,
        original: vOriginal,
        searchText,
      });
      (v.sizes ?? []).forEach((s, i) => rows.push(sizeRow(p, s, i, v.id, searchText)));
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Parseo y validación
// ---------------------------------------------------------------------------

/** Convierte lo que escribe/pega el usuario en número. Acepta "$ 1,234.50",
 *  "1.234,50", "12,5", "1500". `null` = vacío. `undefined` = inválido. */
export function parseBulkNumber(raw: string): number | null | undefined {
  let s = (raw ?? '').toString().trim();
  if (!s) return null;
  s = s.replace(/[\s$€£]|bs\.?|usd|ves/gi, '');
  if (!s) return null;
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma >= 0 && lastDot >= 0) {
    // El último separador es el decimal; el otro es de miles.
    if (lastComma > lastDot) s = s.replace(/\./g, '').replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (lastComma >= 0) {
    // "1,000" / "12,000,000" = miles · "12,5" = decimal.
    s = /^-?\d{1,3}(,\d{3})+$/.test(s) ? s.replace(/,/g, '') : s.replace(',', '.');
  } else if ((s.match(/\./g) ?? []).length > 1) {
    // "1.000.000" = miles.
    s = s.replace(/\./g, '');
  }
  if (!/^-?\d*\.?\d+$/.test(s) && !/^-?\d+\.$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

/** "Sí"/"No", true/false, 1/0, x… `null` = no se entiende. */
export function parseBulkBool(raw: string | boolean): boolean | null {
  if (typeof raw === 'boolean') return raw;
  const s = normalizeSearch((raw ?? '').toString().trim());
  if (['si', 'yes', 'true', 'verdadero', '1', 'x', 'y', 's', 'v', '✓', '✔'].includes(s)) return true;
  if (['no', 'false', 'falso', '0', 'n', 'f', ''].includes(s)) return false;
  return null;
}

/** Mensaje de error de una celda, o null si es válida. */
export function validateBulkCell(
  row: BulkRow,
  key: BulkColumnKey,
  value: BulkCellValue
): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  switch (key) {
    case 'name':
      return text ? null : 'El nombre es obligatorio';
    case 'option':
      return text
        ? null
        : row.kind === 'size'
          ? 'La talla necesita un nombre'
          : 'La variante necesita un nombre';
    case 'price': {
      const n = parseBulkNumber(text);
      if (n === null) return 'El precio es obligatorio';
      if (n === undefined) return 'No es un número';
      return n < 0 ? 'No puede ser negativo' : null;
    }
    case 'stock':
    case 'pricePromotional':
    case 'originalPrice':
    case 'productionCost': {
      const n = parseBulkNumber(text);
      if (n === undefined) return 'No es un número';
      if (n !== null && n < 0) return 'No puede ser negativo';
      if (key === 'stock' && n !== null && !Number.isInteger(n)) return 'Usa un número entero';
      return null;
    }
    case 'visible':
    case 'soldOut':
      return typeof value === 'boolean' ? null : 'Usa Sí o No';
    default:
      return null;
  }
}

/** ¿Dos valores de celda significan lo mismo? ("20" = "20.00"). */
export function sameBulkValue(
  type: BulkColumnType,
  a: BulkCellValue | undefined,
  b: BulkCellValue | undefined
): boolean {
  if (type === 'bool') return a === b;
  const sa = typeof a === 'string' ? a.trim() : String(a ?? '');
  const sb = typeof b === 'string' ? b.trim() : String(b ?? '');
  if (type === 'number') {
    const na = parseBulkNumber(sa);
    const nb = parseBulkNumber(sb);
    if (na !== undefined && nb !== undefined) return na === nb;
  }
  return sa === sb;
}

// ---------------------------------------------------------------------------
// Portapapeles (TSV, el formato que usan Excel y Google Sheets)
// ---------------------------------------------------------------------------

/** Parsea texto copiado de Excel/Sheets: filas por salto de línea, celdas por
 *  tabulador, comillas dobles para celdas con saltos/tabs. */
export function parseTsv(text: string): string[][] {
  const src = (text ?? '').replace(/\r\n?/g, '\n');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let i = 0;
  let quoted = false;
  while (i < src.length) {
    const ch = src[i];
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i++;
        continue;
      }
      cell += ch;
      i++;
      continue;
    }
    if (ch === '"' && cell === '') {
      quoted = true;
      i++;
      continue;
    }
    if (ch === '\t') {
      row.push(cell);
      cell = '';
    } else if (ch === '\n') {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
    i++;
  }
  // Excel termina el portapapeles con un salto de línea: no es una fila extra.
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.length ? rows : [['']];
}

export function toTsv(matrix: string[][]): string {
  return matrix
    .map((r) =>
      r.map((c) => (/[\t\n"]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join('\t')
    )
    .join('\n');
}

// ---------------------------------------------------------------------------
// Guardado
// ---------------------------------------------------------------------------

export interface BulkVariantPatch {
  variantId: string;
  name?: string;
  stock?: number | null;
  sku?: string | null;
  price?: number;
  originalPrice?: number;
  isHidden?: boolean;
}

export interface BulkSizePatch {
  /** null = talla del producto ("Producto original"). */
  variantId: string | null;
  index: number;
  originalName: string;
  name?: string;
  stock?: number | null;
  sku?: string | null;
}

export interface BulkProductPatch {
  productId: string;
  productName: string;
  /** Columnas de `products` a actualizar (solo las que cambiaron). */
  fields: {
    name?: string;
    stock?: number | null;
    sku?: string | null;
    price?: number;
    price_promotional?: number | null;
    production_cost?: number | null;
    is_hidden?: boolean;
    is_sold_out?: boolean;
  };
  variants: BulkVariantPatch[];
  sizes: BulkSizePatch[];
  /** Para el historial de actividad del equipo. */
  changes: { field: string; from: unknown; to: unknown }[];
}

const num = (v: BulkCellValue | undefined) =>
  parseBulkNumber(typeof v === 'string' ? v : '') ?? null;
const text = (v: BulkCellValue | undefined) => (typeof v === 'string' ? v.trim() : '');
const optText = (v: BulkCellValue | undefined) => text(v) || null;

/** Agrupa las celdas modificadas en un parche por producto. Asume que las
 *  celdas ya pasaron `validateBulkCell`. */
export function buildBulkPatches(rows: BulkRow[], edits: BulkEdits): BulkProductPatch[] {
  const byProduct = new Map<string, BulkProductPatch>();
  const patchFor = (row: BulkRow) => {
    let patch = byProduct.get(row.productId);
    if (!patch) {
      patch = {
        productId: row.productId,
        productName: row.productName,
        fields: {},
        variants: [],
        sizes: [],
        changes: [],
      };
      byProduct.set(row.productId, patch);
    }
    return patch;
  };

  for (const row of rows) {
    const e = edits.get(row.key);
    if (!e || !Object.keys(e).length) continue;
    const patch = patchFor(row);
    const label = (k: BulkColumnKey) => {
      const col = BULK_COLUMNS.find((c) => c.key === k)?.label ?? k;
      if (row.kind === 'variant') return `${col} (${text(row.original.option)})`;
      if (row.kind === 'size') return `${col} (talla ${row.sizeName})`;
      return col;
    };
    for (const k of Object.keys(e) as BulkColumnKey[]) {
      patch.changes.push({ field: label(k), from: row.original[k], to: e[k] });
    }

    if (row.kind === 'product') {
      const f = patch.fields;
      if ('name' in e) f.name = text(e.name);
      if ('stock' in e) f.stock = num(e.stock);
      if ('sku' in e) f.sku = optText(e.sku);
      if ('price' in e) f.price = num(e.price) ?? 0;
      if ('pricePromotional' in e) {
        const n = num(e.pricePromotional);
        f.price_promotional = n ? n : null;
      }
      if ('productionCost' in e) f.production_cost = num(e.productionCost);
      if ('visible' in e) f.is_hidden = !e.visible;
      if ('soldOut' in e) f.is_sold_out = !!e.soldOut;
    } else if (row.kind === 'variant' && row.variantId) {
      const v: BulkVariantPatch = { variantId: row.variantId };
      if ('option' in e) v.name = text(e.option);
      if ('stock' in e) v.stock = num(e.stock);
      if ('sku' in e) v.sku = optText(e.sku);
      if ('price' in e) v.price = num(e.price) ?? 0;
      if ('originalPrice' in e) v.originalPrice = num(e.originalPrice) ?? 0;
      if ('visible' in e) v.isHidden = !e.visible;
      patch.variants.push(v);
    } else if (row.kind === 'size' && row.sizeIndex !== null) {
      const s: BulkSizePatch = {
        variantId: row.variantId,
        index: row.sizeIndex,
        originalName: row.sizeName ?? '',
      };
      if ('option' in e) s.name = text(e.option);
      if ('stock' in e) s.stock = num(e.stock);
      if ('sku' in e) s.sku = optText(e.sku);
      patch.sizes.push(s);
    }
  }
  return [...byProduct.values()];
}

type JsonSize = { name: string; stock: number | null; sku?: string | null };
type JsonVariant = { id: string; name: string; sizes?: JsonSize[]; [k: string]: unknown };

/** Aplica los cambios de variantes/tallas sobre el JSON ACTUAL de la base
 *  (recién leído), no sobre la copia cargada en pantalla: así no se pisa el
 *  stock que una venta haya descontado mientras el usuario editaba. Devuelve
 *  un error legible si una variante/talla ya no existe. */
export function applyBulkJsonPatch(
  current: { sizes: JsonSize[] | null; variants: JsonVariant[] | null },
  patch: Pick<BulkProductPatch, 'variants' | 'sizes'>
): { sizes: JsonSize[]; variants: JsonVariant[] } | { error: string } {
  const sizes = (current.sizes ?? []).map((s) => ({ ...s }));
  const variants: JsonVariant[] = (current.variants ?? []).map(
    (v): JsonVariant => ({ ...v, sizes: (v.sizes ?? []).map((s) => ({ ...s })) })
  );

  for (const vp of patch.variants) {
    const v = variants.find((x) => String(x.id) === String(vp.variantId));
    if (!v) return { error: 'Una variante ya no existe. Recarga la página.' };
    if (vp.name !== undefined) v.name = vp.name;
    if (vp.stock !== undefined) v['stock'] = vp.stock;
    if (vp.sku !== undefined) v['sku'] = vp.sku;
    if (vp.price !== undefined) v['price'] = vp.price;
    if (vp.originalPrice !== undefined) v['originalPrice'] = vp.originalPrice;
    if (vp.isHidden !== undefined) v['isHidden'] = vp.isHidden;
  }

  for (const sp of patch.sizes) {
    let list: JsonSize[];
    if (sp.variantId === null) {
      list = sizes;
    } else {
      const v = variants.find((x) => String(x.id) === String(sp.variantId));
      if (!v) return { error: 'Una variante ya no existe. Recarga la página.' };
      list = v.sizes as JsonSize[];
    }
    let size: JsonSize | undefined = list[sp.index];
    if (!size || size.name !== sp.originalName) {
      size = list.find((s) => s.name === sp.originalName);
    }
    if (!size) return { error: `La talla "${sp.originalName}" ya no existe. Recarga la página.` };
    if (sp.name !== undefined) size.name = sp.name;
    if (sp.stock !== undefined) size.stock = sp.stock;
    if (sp.sku !== undefined) size.sku = sp.sku;
  }

  return { sizes, variants };
}
