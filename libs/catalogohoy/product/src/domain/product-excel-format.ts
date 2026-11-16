import type {
  ProductAddon,
  ProductSize,
  ProductVariant,
  WholesaleTier,
} from './product.model';

/**
 * Formato de texto de las columnas "ricas" del Excel de productos
 * (variantes, tallas, adicionales, mayoreo). El export las escribe y el import
 * las lee con las MISMAS reglas, así un archivo exportado se puede editar y
 * volver a subir (CAT-116).
 *
 *   tallas       S: 5, M, L: 0              (sin número = sin límite)
 *   variantes    Rojo: 10 (antes 12) (stock 5) (sku R-1) [tallas: S: 2, M: 3] | Azul: 12 (oculta)
 *   adicionales  Tarjeta: 2 | Envoltorio: 0 (por defecto)
 *   mayoreo      Docena: 8 | Caja: 6
 *
 * Paréntesis que no son una de las marcas conocidas (antes/stock/sku/oculta/
 * por defecto) se quedan en el nombre: "Casco (talla única): 30".
 */

/** Talla leída del Excel. `stock: null` = sin límite. */
export interface ExcelSize {
  name: string;
  stock: number | null;
}

/** Variante leída del Excel. `undefined` en un campo = la celda no lo dice →
 *  al actualizar se conserva lo que ya tenía la variante en la app. */
export interface ExcelVariant {
  name: string;
  /** null = no trae precio → usa el precio del producto. */
  price: number | null;
  /** 0 = sin precio "antes". */
  originalPrice: number;
  /** undefined = no dice (conserva); null = sin límite explícito. */
  stock?: number | null;
  sku?: string | null;
  hidden?: boolean;
  sizes: ExcelSize[];
}

export interface ExcelAddon {
  name: string;
  price: number;
  isDefault: boolean;
}

const UNLIMITED_RE = /^(sin\s+l[ií]mite|ilimitad[oa]|∞)$/i;

/** "10", "10.5", "10,5", "$10" → número. Vacío / inválido → null. */
export function parseExcelNumber(raw: unknown): number | null {
  if (raw == null) return null;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  let s = String(raw).trim().replace(/[$€\s]/g, '');
  if (!s) return null;
  // Coma decimal (10,5) solo si no hay punto; con ambos (1.234,5) estilo europeo.
  if (s.includes(',') && s.includes('.')) {
    s = s.lastIndexOf(',') > s.lastIndexOf('.')
      ? s.replace(/\./g, '').replace(',', '.')
      : s.replace(/,/g, '');
  } else if (/^-?\d+,\d+$/.test(s)) {
    s = s.replace(',', '.');
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Separa por `sep` ignorando lo que esté dentro de [ ] o ( ). */
function splitTopLevel(text: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of text) {
    if (ch === '[' || ch === '(') depth++;
    if ((ch === ']' || ch === ')') && depth > 0) depth--;
    if (ch === sep && depth === 0) {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((s) => s.trim()).filter(Boolean);
}

/** "Nombre: 10" → { name, value: "10" }. Sin ":" o sin valor → value null. */
function splitNameValue(item: string): { name: string; value: string | null } {
  const idx = item.lastIndexOf(':');
  if (idx < 0) return { name: item.trim(), value: null };
  const name = item.slice(0, idx).trim();
  const value = item.slice(idx + 1).trim();
  if (!name) return { name: item.trim(), value: null };
  return { name, value: value || null };
}

// ── Tallas ────────────────────────────────────────────────────────────────

export function formatExcelSizes(
  sizes: { name: string; stock: number | null }[] | undefined
): string {
  if (!sizes?.length) return '';
  return sizes
    .map((s) => (s.stock != null ? `${s.name}: ${s.stock}` : s.name))
    .join(', ');
}

export function parseExcelSizes(text: unknown): ExcelSize[] {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  return splitTopLevel(raw, ',').map((item) => {
    const { name, value } = splitNameValue(item);
    if (value == null) return { name, stock: null };
    if (UNLIMITED_RE.test(value)) return { name, stock: null };
    const n = parseExcelNumber(value);
    // "Talla: XL" → no es stock, es parte del nombre.
    if (n == null) return { name: item.trim(), stock: null };
    return { name, stock: Math.max(0, Math.trunc(n)) };
  });
}

// ── Variantes ─────────────────────────────────────────────────────────────

export function formatExcelVariants(variants: ProductVariant[]): string {
  return variants
    .map((v) => {
      const parts = [`${v.name}: ${v.price}`];
      if (v.originalPrice) parts.push(`(antes ${v.originalPrice})`);
      // Con tallas el stock vive en cada talla.
      if (!v.sizes?.length && v.stock != null) parts.push(`(stock ${v.stock})`);
      if (v.sku) parts.push(`(sku ${v.sku})`);
      if (v.isHidden) parts.push('(oculta)');
      if (v.sizes?.length) parts.push(`[tallas: ${formatExcelSizes(v.sizes)}]`);
      return parts.join(' ');
    })
    .join(' | ');
}

export function parseExcelVariants(text: unknown): ExcelVariant[] {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  const out: ExcelVariant[] = [];
  for (const item of splitTopLevel(raw, '|')) {
    let rest = item;
    let sizes: ExcelSize[] = [];
    rest = rest.replace(/\[\s*tallas?\s*:?\s*([^\]]*)\]/i, (_m, inner) => {
      sizes = parseExcelSizes(inner);
      return ' ';
    });

    const v: ExcelVariant = { name: '', price: null, originalPrice: 0, sizes };
    rest = rest.replace(/\(([^()]*)\)/g, (m, inner: string) => {
      const t = inner.trim();
      let k: RegExpMatchArray | null;
      if ((k = t.match(/^antes\s*:?\s*(.+)$/i))) {
        v.originalPrice = parseExcelNumber(k[1]) ?? 0;
        return ' ';
      }
      if ((k = t.match(/^stock\s*:?\s*(.+)$/i))) {
        const s = k[1].trim();
        v.stock = UNLIMITED_RE.test(s)
          ? null
          : (() => {
              const n = parseExcelNumber(s);
              return n == null ? null : Math.max(0, Math.trunc(n));
            })();
        return ' ';
      }
      if ((k = t.match(/^sku\s*:?\s*(.+)$/i))) {
        v.sku = k[1].trim() || null;
        return ' ';
      }
      if (/^ocult[ao]$/i.test(t)) {
        v.hidden = true;
        return ' ';
      }
      if (/^visible$/i.test(t)) {
        v.hidden = false;
        return ' ';
      }
      return m; // paréntesis del nombre
    });

    const { name, value } = splitNameValue(rest.replace(/\s+/g, ' ').trim());
    const price = value != null ? parseExcelNumber(value) : null;
    v.name = price == null && value != null ? `${name}: ${value}` : name;
    v.price = price;
    if (v.name) out.push(v);
  }
  return out;
}

// ── Adicionales ───────────────────────────────────────────────────────────

export function formatExcelAddons(addons: ProductAddon[]): string {
  return addons
    .map((a) => `${a.name}: ${a.price}${a.isDefault ? ' (por defecto)' : ''}`)
    .join(' | ');
}

export function parseExcelAddons(text: unknown): ExcelAddon[] {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  const out: ExcelAddon[] = [];
  for (const item of splitTopLevel(raw, '|')) {
    let isDefault = false;
    const rest = item
      .replace(/\(\s*(por\s+defecto|marcad[oa]|predeterminad[oa])\s*\)/i, () => {
        isDefault = true;
        return ' ';
      })
      .replace(/\s+/g, ' ')
      .trim();
    const { name, value } = splitNameValue(rest);
    const price = value != null ? parseExcelNumber(value) : null;
    const finalName = price == null && value != null ? `${name}: ${value}` : name;
    if (finalName) out.push({ name: finalName, price: price ?? 0, isDefault });
  }
  return out;
}

// ── Mayoreo ───────────────────────────────────────────────────────────────

export function formatExcelWholesale(tiers: WholesaleTier[]): string {
  return tiers.map((t) => `${t.title}: ${t.price}`).join(' | ');
}

export function parseExcelWholesale(text: unknown): WholesaleTier[] {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  return splitTopLevel(raw, '|')
    .map((item) => {
      const { name, value } = splitNameValue(item);
      const price = value != null ? parseExcelNumber(value) : null;
      return price == null ? null : { title: name, price };
    })
    .filter((t): t is WholesaleTier => !!t);
}

// ── Mezcla con lo que ya existe (re-import) ───────────────────────────────

const key = (s: string) => s.trim().toLowerCase();

/** Tallas del Excel conservando el SKU de la talla existente con el mismo nombre. */
export function mergeExcelSizes(
  incoming: ExcelSize[],
  existing: ProductSize[] = []
): ProductSize[] {
  const byName = new Map(existing.map((s) => [key(s.name), s]));
  return incoming.map((s) => ({
    name: s.name,
    stock: s.stock,
    sku: byName.get(key(s.name))?.sku ?? null,
  }));
}

/** Variantes del Excel → variantes del producto. Las que ya existían (mismo
 *  nombre) conservan id, fotos y lo que la celda no dice (stock, sku, oculta);
 *  las nuevas nacen sin fotos y visibles. Las que no están en la celda se
 *  quitan: la celda es la lista completa. */
export function mergeExcelVariants(
  incoming: ExcelVariant[],
  existing: ProductVariant[] = [],
  basePrice: number,
  newId: () => string = () => crypto.randomUUID()
): ProductVariant[] {
  const byName = new Map(existing.map((v) => [key(v.name), v]));
  return incoming.map((v) => {
    const prev = byName.get(key(v.name));
    const sizes = mergeExcelSizes(v.sizes, prev?.sizes ?? []);
    return {
      id: prev?.id ?? newId(),
      name: v.name,
      price: v.price ?? basePrice,
      originalPrice: v.originalPrice,
      sku: v.sku !== undefined ? v.sku : (prev?.sku ?? null),
      photos: prev?.photos ?? [],
      stock: sizes.length
        ? null
        : v.stock !== undefined
          ? v.stock
          : (prev?.stock ?? null),
      sizes,
      isHidden: v.hidden !== undefined ? v.hidden : !!prev?.isHidden,
    };
  });
}

/** Adicionales del Excel conservando id y foto de los que ya existían. */
export function mergeExcelAddons(
  incoming: ExcelAddon[],
  existing: ProductAddon[] = [],
  newId: () => string = () => crypto.randomUUID()
): ProductAddon[] {
  const byName = new Map(existing.map((a) => [key(a.name), a]));
  return incoming.map((a) => {
    const prev = byName.get(key(a.name));
    return {
      id: prev?.id ?? newId(),
      name: a.name,
      price: a.price,
      photo: prev?.photo ?? null,
      isDefault: a.isDefault,
    };
  });
}
