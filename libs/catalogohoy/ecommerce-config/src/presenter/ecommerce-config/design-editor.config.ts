/**
 * Configuración del editor de diseño del catálogo (CAT-103, variante A:
 * menú lateral por secciones + vista previa móvil/escritorio).
 *
 * Las opciones de `DesignLook` todavía no se persisten ni las renderiza el
 * storefront: hoy solo viven en el editor para iterar la interfaz.
 */

/** Secciones del menú lateral (pocas a propósito, estilo Linktree). */
export type DesignSectionId =
  | 'general'
  | 'tema'
  | 'texto'
  | 'productos'
  | 'categorias'
  | 'pie'
  | 'pagos'
  | 'envio'
  | 'ubicacion'
  | 'redes';

/** Sub-pantallas de "Diseño" (se abren desde una fila y vuelven con ←). */
export type DesignSubId = 'tema' | 'fondo' | 'botones' | 'texto' | 'colores' | 'pie';

export type LegacyTab = 'general' | 'location' | 'payments' | 'shipping' | 'social' | 'notifications';

/** Tabs del editor viejo cuyo contenido se muestra dentro de cada sección. */
export const LEGACY_SECTION_TABS: Partial<Record<DesignSectionId, LegacyTab[]>> = {
  general: ['general'],
  pagos: ['payments'],
  envio: ['shipping'],
  ubicacion: ['location'],
  redes: ['social', 'notifications'],
};

/** Tab "activo" (decide si el preview muestra el catálogo o el checkout). */
export const PREVIEW_TAB: Partial<Record<DesignSectionId, LegacyTab>> = {
  pagos: 'payments',
  envio: 'shipping',
};

/** Deep links viejos `?tab=` → sección nueva. */
export const TAB_TO_SECTION: Record<LegacyTab, DesignSectionId> = {
  general: 'general',
  location: 'ubicacion',
  payments: 'pagos',
  shipping: 'envio',
  social: 'redes',
  notifications: 'redes',
};

export interface DesignNavItem<T extends string = DesignSectionId> {
  id: T;
  label: string;
  icon: string;
  hint: string;
}

export interface DesignNavGroup {
  label: string;
  items: DesignNavItem[];
}

export const DESIGN_NAV: DesignNavGroup[] = [
  {
    label: 'Básico',
    items: [
      { id: 'general', label: 'General', icon: 'store', hint: 'Información básica de tu tienda, plantilla y dirección del catálogo.' },
    ],
  },
  {
    label: 'Estilo',
    items: [
      { id: 'tema', label: 'Tema', icon: 'sparkles', hint: 'Tema, colores, fondo y botones.' },
      { id: 'texto', label: 'Fuente y texto', icon: 'type', hint: 'Tipografía, tamaño del texto y estilo de los títulos.' },
    ],
  },
  {
    label: 'Contenido',
    items: [
      { id: 'productos', label: 'Productos', icon: 'shopping-bag', hint: 'Cómo se ven tus productos y cuáles destacar.' },
      { id: 'categorias', label: 'Categorías', icon: 'tag', hint: 'Estilo, orden y qué categorías se muestran.' },
      { id: 'pie', label: 'Pie de página', icon: 'panel-bottom', hint: 'Redes, horario y texto final.' },
    ],
  },
  {
    label: 'Checkout',
    items: [
      { id: 'pagos', label: 'Pagos', icon: 'credit-card', hint: 'Métodos de pago, monedas, vendedores y mensaje de WhatsApp.' },
      { id: 'envio', label: 'Envío', icon: 'truck', hint: 'Métodos de envío, datos del cliente y fecha de entrega.' },
    ],
  },
  {
    label: 'Adicionales',
    items: [
      { id: 'ubicacion', label: 'Ubicación y horario', icon: 'map-pin', hint: 'Dónde estás, cuándo atiendes e idioma del catálogo.' },
      { id: 'redes', label: 'Redes y avisos', icon: 'share2', hint: 'Redes sociales, píxel de Meta y notificaciones.' },
    ],
  },
];

export const DESIGN_SUBS: DesignNavItem<DesignSubId>[] = [
  { id: 'tema', label: 'Tema', icon: 'sparkles', hint: 'Combinaciones listas para usar. Luego ajusta lo que quieras.' },
  { id: 'fondo', label: 'Fondo', icon: 'image', hint: 'Color, degradado, desenfoque, patrón, imagen o video.' },
  { id: 'botones', label: 'Botones', icon: 'mouse-pointer-click', hint: 'Forma, estilo y texto de los botones.' },
  { id: 'texto', label: 'Fuente y texto', icon: 'type', hint: 'Tipografía y tamaño del texto.' },
  { id: 'colores', label: 'Colores', icon: 'palette', hint: 'Color principal de tu catálogo.' },
  { id: 'pie', label: 'Pie de página', icon: 'panel-bottom', hint: 'Redes, horario y texto final.' },
];

export type BgType = 'fill' | 'gradient' | 'blur' | 'pattern' | 'image' | 'video';
export type ButtonShape = 'square' | 'rounded' | 'pill';
export type ButtonStyle = 'solid' | 'outline' | 'soft';

export interface DesignLook {
  theme: string | null;
  bgType: BgType;
  bgColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientVia: string;
  brutal: boolean;
  pattern: 'dots' | 'grid' | 'diagonal' | 'waves';
  glassCards: boolean;
  /** Imagen / video de fondo (URL del CDN) y oscurecido 0..70 (%). */
  bgImage: string;
  bgVideo: string;
  bgDim: number;
  buttonShape: ButtonShape;
  buttonStyle: ButtonStyle;
  buttonShadow: boolean;
  buttonText: string;
  buttonSize: 'sm' | 'md' | 'lg';
  /** Paleta del tema: tarjetas, bordes, texto y texto secundario. */
  surfaceColor: string;
  borderColor: string;
  textColor: string;
  mutedColor: string;
  font: string;
  headingStyle: 'same' | 'serif' | 'bold';
  textScale: number;
  productLayout: 'grid2' | 'grid3' | 'grid4' | 'list';
  cardStyle: 'filled' | 'flat' | 'border';
  showPrice: boolean;
  showStockBadge: boolean;
  showFeatured: boolean;
  featuredIds: string[];
  categoryStyle: 'chips' | 'tabs' | 'icons';
  categoryOrder: 'manual' | 'az' | 'popular';
  hideEmptyCategories: boolean;
  showCategoryCount: boolean;
  footerSocial: boolean;
  footerHours: boolean;
  footerBrand: boolean;
  footerText: string;
}

export const DEFAULT_DESIGN_LOOK: DesignLook = {
  theme: null,
  bgType: 'fill',
  bgColor: '#ffffff',
  gradientFrom: '#c7d2fe',
  gradientTo: '#fbcfe8',
  gradientVia: '',
  brutal: false,
  pattern: 'dots',
  glassCards: true,
  bgImage: '',
  bgVideo: '',
  bgDim: 25,
  buttonShape: 'rounded',
  buttonStyle: 'solid',
  buttonShadow: false,
  buttonText: 'Agregar',
  buttonSize: 'md',
  surfaceColor: '#ffffff',
  borderColor: '#e8e8ec',
  textColor: '#111827',
  mutedColor: '#6b7280',
  font: 'Inter',
  headingStyle: 'same',
  textScale: 100,
  productLayout: 'grid2',
  cardStyle: 'filled',
  showPrice: true,
  showStockBadge: true,
  showFeatured: true,
  featuredIds: [],
  categoryStyle: 'tabs',
  categoryOrder: 'manual',
  hideEmptyCategories: false,
  showCategoryCount: false,
  footerSocial: true,
  footerHours: true,
  footerBrand: true,
  footerText: '',
};

export interface DesignTheme {
  id: string;
  name: string;
  /** Color principal (botones, precios, pestaña activa). */
  color: string;
  /** Fondo de la miniatura en el editor. */
  bg: string;
  text: string;
  look: Partial<DesignLook>;
  /** Tema de plan pago (corona en plan gratis). Sin dato: todos menos "claro". */
  isPremium?: boolean;
}

/** Fondo CSS de la miniatura a partir del look (temas que vienen de la base). */
export function themePreviewBg(look: Partial<DesignLook>): string {
  const bg = look.bgColor || '#ffffff';
  if (look.bgType === 'gradient' || look.bgType === 'blur') {
    const stops = [look.gradientFrom, look.gradientVia, look.gradientTo].filter(Boolean).join(',');
    return `linear-gradient(170deg,${stops || bg})`;
  }
  return bg;
}

/** Paleta completa de un tema "plano" (fondo + tarjeta + borde + textos). */
const palette = (bgColor: string, surfaceColor: string, borderColor: string, textColor: string, mutedColor: string) =>
  ({ bgType: 'fill' as const, bgColor, surfaceColor, borderColor, textColor, mutedColor });

/**
 * Temas curados. Desde 2026-11-14 la fuente de verdad es la tabla
 * `catalog_themes` (se editan en el panel interno → Temas de catálogo); esta
 * lista queda solo como respaldo si la consulta falla.
 *
 * Temas curados: cada uno trae fondo, tarjeta, borde, texto, texto secundario,
 * color principal, fuente y botones que combinan entre sí. La cabecera usa el
 * mismo fondo de la página; solo las tarjetas se separan (tono + borde sutil).
 */
export const DESIGN_THEMES: DesignTheme[] = [
  // ── Claros y sobrios ──────────────────────────────────────────────────
  { id: 'claro', name: 'Claro', color: '#4f46e5', bg: '#ffffff', text: '#111827',
    look: { ...palette('#ffffff', '#ffffff', '#e8e8ec', '#111827', '#6b7280'), brutal: false, font: 'Inter', buttonShape: 'rounded', buttonStyle: 'solid', buttonSize: 'md' } },
  { id: 'mineral', name: 'Mineral', color: '#1c1917', bg: '#fbf3ea', text: '#1c1917',
    look: { ...palette('#fbf3ea', '#fffaf4', '#eadccb', '#1c1917', '#78716c'), brutal: false, font: 'Inter', buttonShape: 'rounded', buttonStyle: 'outline', buttonSize: 'sm' } },
  { id: 'arena', name: 'Arena', color: '#9a5b25', bg: '#f7f1e8', text: '#3a2a1a',
    look: { ...palette('#f7f1e8', '#fffdf9', '#eadfcd', '#3a2a1a', '#86735c'), brutal: false, font: 'Playfair Display', buttonShape: 'pill', buttonStyle: 'outline', buttonSize: 'sm' } },
  // ── Degradados con tarjetas de vidrio ────────────────────────────────
  { id: 'algodon', name: 'Algodón', color: '#9d2c6b', bg: 'linear-gradient(170deg,#e7a3d4,#f5c9de)', text: '#3a0d27',
    look: { bgType: 'gradient', gradientFrom: '#e7a3d4', gradientVia: '', gradientTo: '#f5c9de', glassCards: true, bgColor: '#efb6d9', surfaceColor: '#ffffff8c', borderColor: '#ffffffb3', textColor: '#3a0d27', mutedColor: '#7a3a5f', brutal: false, font: 'Playfair Display', buttonShape: 'rounded', buttonStyle: 'soft', buttonSize: 'md' } },
  { id: 'atardecer', name: 'Atardecer', color: '#ffffff', bg: 'linear-gradient(170deg,#8b2e5a,#e0573f,#4f46e5)', text: '#ffffff',
    look: { bgType: 'gradient', gradientFrom: '#8b2e5a', gradientVia: '#d9573f', gradientTo: '#4f46e5', glassCards: true, bgColor: '#8b2e5a', surfaceColor: '#ffffff1f', borderColor: '#ffffff40', textColor: '#ffffff', mutedColor: '#f3d6dc', brutal: false, font: 'Poppins', buttonShape: 'pill', buttonStyle: 'outline', buttonSize: 'sm' } },
  { id: 'crepusculo', name: 'Crepúsculo', color: '#f0c3f4', bg: 'linear-gradient(170deg,#2f2a5e,#8a4c9c)', text: '#f7f3ff',
    look: { bgType: 'gradient', gradientFrom: '#2f2a5e', gradientVia: '', gradientTo: '#8a4c9c', glassCards: true, bgColor: '#2f2a5e', surfaceColor: '#ffffff1a', borderColor: '#ffffff33', textColor: '#f7f3ff', mutedColor: '#d3c6ea', brutal: false, font: 'Nunito', buttonShape: 'pill', buttonStyle: 'solid', buttonSize: 'md' } },
  { id: 'electrico', name: 'Eléctrico', color: '#ffffff', bg: 'linear-gradient(170deg,#1d4ed8,#c026d3)', text: '#ffffff',
    look: { bgType: 'gradient', gradientFrom: '#1d4ed8', gradientVia: '', gradientTo: '#c026d3', glassCards: true, bgColor: '#1d4ed8', surfaceColor: '#ffffff1f', borderColor: '#ffffff40', textColor: '#ffffff', mutedColor: '#dbe4ff', brutal: false, font: 'Space Grotesk', buttonShape: 'pill', buttonStyle: 'solid', buttonSize: 'sm' } },
  // ── Con personalidad ─────────────────────────────────────────────────
  { id: 'bloque', name: 'Bloque', color: '#d35bd7', bg: '#6d28d9', text: '#ffffff',
    look: { ...palette('#6d28d9', '#8b3fe6', '#111111', '#ffffff', '#eadcff'), brutal: true, font: 'Space Grotesk', buttonShape: 'square', buttonStyle: 'solid', buttonSize: 'md' } },
  { id: 'cuadricula', name: 'Cuadrícula', color: '#111111', bg: '#e6f4c4', text: '#111111',
    look: { bgType: 'pattern', pattern: 'grid', bgColor: '#e6f4c4', surfaceColor: '#ffffff', borderColor: '#111111', textColor: '#111111', mutedColor: '#3f4a2a', brutal: true, font: 'Space Grotesk', buttonShape: 'pill', buttonStyle: 'outline', buttonSize: 'md' } },
  { id: 'jade', name: 'Jade', color: '#c6f432', bg: 'linear-gradient(170deg,#0e3b3a,#1f6f5c,#2a8f7e)', text: '#e9fbb0',
    look: { bgType: 'gradient', gradientFrom: '#0e3b3a', gradientVia: '#1f6f5c', gradientTo: '#2a8f7e', glassCards: true, bgColor: '#0e3b3a', surfaceColor: '#0a2a2a99', borderColor: '#c6f43233', textColor: '#e9fbb0', mutedColor: '#a9d6c4', brutal: false, font: 'Playfair Display', buttonShape: 'pill', buttonStyle: 'solid', buttonSize: 'md' } },
  // ── Oscuros ──────────────────────────────────────────────────────────
  { id: 'lago', name: 'Lago', color: '#38bdf8', bg: '#0b1120', text: '#e6e9f2',
    look: { ...palette('#0b1120', '#111a2e', '#1d2942', '#e6e9f2', '#8b98b0'), brutal: false, font: 'Inter', buttonShape: 'rounded', buttonStyle: 'outline', buttonSize: 'sm' } },
  { id: 'carbon', name: 'Carbón', color: '#f5f5f4', bg: '#111110', text: '#f5f5f4',
    look: { ...palette('#111110', '#191918', '#2a2a28', '#f5f5f4', '#a8a29e'), brutal: false, font: 'Inter', buttonShape: 'square', buttonStyle: 'solid', buttonSize: 'sm' } },
];

export const DESIGN_FONTS = ['Inter', 'Poppins', 'Playfair Display', 'Space Grotesk', 'DM Serif Display', 'Nunito'];
