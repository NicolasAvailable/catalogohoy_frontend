/**
 * Temas del editor de catálogos (tabla `catalog_themes`). Elegir un tema en el
 * editor de la tienda copia `color` → themeColor y `look` → design.look, así que
 * editar un tema acá no cambia catálogos ya guardados.
 *
 * Los campos de `ThemeLook` son un subconjunto de `CatalogLook`
 * (libs/catalogohoy/e-commerce/src/domain/catalog-look.ts): solo lo que define
 * un tema (fondo, paleta, fuente, botones).
 */
export type ThemeBgType = 'fill' | 'gradient' | 'pattern';
export type ThemePattern = 'dots' | 'grid' | 'diagonal' | 'waves';
export type ThemeButtonShape = 'square' | 'rounded' | 'pill';
export type ThemeButtonStyle = 'solid' | 'outline' | 'soft';
export type ThemeButtonSize = 'sm' | 'md' | 'lg';

export interface ThemeLook {
  bgType: ThemeBgType;
  bgColor: string;
  gradientFrom: string;
  gradientVia: string;
  gradientTo: string;
  pattern: ThemePattern;
  glassCards: boolean;
  brutal: boolean;
  surfaceColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  font: string;
  buttonShape: ThemeButtonShape;
  buttonStyle: ThemeButtonStyle;
  buttonSize: ThemeButtonSize;
}

export interface CatalogTheme {
  id: string;
  name: string;
  /** Color principal (botones, precios, pestaña activa). */
  color: string;
  look: ThemeLook;
  isPremium: boolean;
  isActive: boolean;
  sortOrder: number;
  storesUsing: number;
  updatedAt: string | null;
}

/** Fuentes que el catálogo sabe cargar (= LOOK_FONTS del storefront). */
export const THEME_FONTS = ['Inter', 'Poppins', 'Playfair Display', 'Space Grotesk', 'DM Serif Display', 'Nunito'];

export const DEFAULT_THEME_LOOK: ThemeLook = {
  bgType: 'fill',
  bgColor: '#ffffff',
  gradientFrom: '#c7d2fe',
  gradientVia: '',
  gradientTo: '#fbcfe8',
  pattern: 'dots',
  glassCards: false,
  brutal: false,
  surfaceColor: '#ffffff',
  borderColor: '#e8e8ec',
  textColor: '#111827',
  mutedColor: '#6b7280',
  font: 'Inter',
  buttonShape: 'rounded',
  buttonStyle: 'solid',
  buttonSize: 'md',
};

const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
export const isHex = (v: string | null | undefined): boolean => !!v && HEX.test(v);

/** id legible a partir del nombre: "Rosa Pastel" → "rosa-pastel". */
export function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/** Fondo CSS del tema (igual que lo pinta el catálogo). */
export function themeBackground(look: ThemeLook): Record<string, string> {
  if (look.bgType === 'gradient') {
    const via = isHex(look.gradientVia) ? `${look.gradientVia}, ` : '';
    return { background: `linear-gradient(170deg, ${look.gradientFrom}, ${via}${look.gradientTo})` };
  }
  if (look.bgType === 'pattern') {
    const c = `color-mix(in srgb, ${look.textColor} 16%, transparent)`;
    const patterns: Record<ThemePattern, [string, string]> = {
      dots: [`radial-gradient(${c} 0.1rem, transparent 0.11rem)`, '0.9rem 0.9rem'],
      grid: [`linear-gradient(${c} 0.0625rem, transparent 0.0625rem), linear-gradient(90deg, ${c} 0.0625rem, transparent 0.0625rem)`, '1.1rem 1.1rem'],
      diagonal: [`repeating-linear-gradient(45deg, ${c} 0 0.125rem, transparent 0.125rem 0.75rem)`, 'auto'],
      waves: [`radial-gradient(circle at 50% 0, transparent 0.5rem, ${c} 0.56rem, transparent 0.64rem)`, '1.25rem 0.75rem'],
    };
    const [img, size] = patterns[look.pattern] ?? patterns.dots;
    return { 'background-color': look.bgColor, 'background-image': img, 'background-size': size };
  }
  return { background: look.bgColor };
}

/** Luminancia relativa (WCAG) de un #rrggbb[aa] (ignora la transparencia). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1, 7), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

export function contrast(a: string, b: string): number {
  if (!isHex(a) || !isHex(b)) return 21;
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

/** Texto legible (blanco/negro) sobre un color. */
export function onColor(hex: string): string {
  if (!isHex(hex)) return '#ffffff';
  return contrast(hex, '#ffffff') >= contrast(hex, '#111111') ? '#ffffff' : '#111111';
}

/** Color "de fondo" representativo (para medir contraste). */
export function mainBg(look: ThemeLook): string {
  return look.bgType === 'gradient' ? look.gradientFrom : look.bgColor;
}
