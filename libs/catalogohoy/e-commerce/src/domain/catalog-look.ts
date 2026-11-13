/**
 * Opciones de diseño del catálogo (CAT-103), guardadas en
 * `tenant_ecommerce_config.design.look`. Todo es opcional: `null`/ausente =
 * el catálogo se ve exactamente como hoy (no se inyecta nada).
 *
 * Se aplican con UNA hoja de estilos generada en runtime (`buildLookCss`) +
 * a lo sumo un <link> de Google Fonts. No hay requests a la base de datos
 * extra: `design` viaja en el mismo RPC `get_public_catalog`.
 */
export interface CatalogLook {
  theme?: string | null;
  bgType?: 'fill' | 'gradient' | 'blur' | 'pattern' | 'image' | 'video';
  bgColor?: string;
  gradientFrom?: string;
  gradientTo?: string;
  /** Color intermedio opcional del degradado (3 paradas). */
  gradientVia?: string;
  /** Estilo "bloque": borde grueso + sombra desplazada en tarjetas y botones. */
  brutal?: boolean;
  pattern?: 'dots' | 'grid' | 'diagonal' | 'waves';
  glassCards?: boolean;
  /** Imagen o video de fondo (URL del CDN) y oscurecido 0..70 (%). */
  bgImage?: string;
  bgVideo?: string;
  bgDim?: number;
  buttonShape?: 'square' | 'rounded' | 'pill';
  buttonStyle?: 'solid' | 'outline' | 'soft';
  buttonShadow?: boolean;
  buttonText?: string;
  /** Tamaño del botón de las tarjetas. */
  buttonSize?: 'sm' | 'md' | 'lg';
  /** Paleta completa del tema (si viene, manda sobre los colores por defecto). */
  surfaceColor?: string;
  borderColor?: string;
  textColor?: string;
  mutedColor?: string;
  /** Fondo sólido de modales, carrito y tarjetas del checkout. */
  panelColor?: string;
  font?: string;
  headingStyle?: 'same' | 'serif' | 'bold';
  textScale?: number;
  productLayout?: 'grid2' | 'grid3' | 'grid4' | 'list';
  cardStyle?: 'filled' | 'flat' | 'border';
  showPrice?: boolean;
  showStockBadge?: boolean;
  showFeatured?: boolean;
  featuredIds?: string[];
  categoryStyle?: 'chips' | 'tabs' | 'icons';
  categoryOrder?: 'manual' | 'az' | 'popular';
  hideEmptyCategories?: boolean;
  showCategoryCount?: boolean;
  footerSocial?: boolean;
  footerHours?: boolean;
  footerBrand?: boolean;
  footerText?: string;
}

/** Fuentes que se ofrecen en el editor (todas en Google Fonts). */
export const LOOK_FONTS = ['Inter', 'Poppins', 'Playfair Display', 'Space Grotesk', 'DM Serif Display', 'Nunito'];

// #rrggbb o #rrggbbaa (con transparencia, p.ej. tarjetas tipo vidrio).
const HEX = /^#[0-9a-f]{6}([0-9a-f]{2})?$/i;
const safeHex = (v: string | undefined, fallback: string) => (v && HEX.test(v) ? v : fallback);

/** true si el color de fondo es oscuro (para invertir texto/tarjetas). */
/** Solo URLs https sin comillas/paréntesis (van dentro de url("…") en CSS). */
export function safeUrl(u: string | null | undefined): string {
  return u && /^https:\/\/[^"'()\s<>]+$/.test(u) ? u : '';
}

export function isDarkColor(hex: string): boolean {
  if (!HEX.test(hex)) return false;
  const n = parseInt(hex.slice(1, 7), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  // Luminancia relativa aproximada (sRGB).
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 110;
}

/** URL de Google Fonts para la fuente elegida, o null (Inter ya viene cargada). */
export function lookFontHref(look: CatalogLook | null | undefined): string | null {
  const font = look?.font;
  if (!font || font === 'Inter' || !LOOK_FONTS.includes(font)) return null;
  const family = font.replace(/ /g, '+');
  const weights = font.includes('Display') ? '' : ':wght@400;600;700';
  return `https://fonts.googleapis.com/css2?family=${family}${weights}&display=swap`;
}

/** ¿Hay algo que aplicar? (look vacío o con todo en default = nada). */
export function hasLook(look: CatalogLook | null | undefined): look is CatalogLook {
  return !!look && Object.keys(look).length > 0;
}

/**
 * Hoja de estilos para el look. Selectores acotados a `.ecommerce` (el shell
 * del storefront) para no tocar nada fuera del catálogo. Usa `!important`
 * porque los estilos de cada componente (encapsulados) tienen más
 * especificidad que una hoja global.
 */
/** Ícono de cuadrícula ("Ver todos" en categorías con íconos), como máscara CSS. */
const GRID_ICON = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='3' width='7' height='7' rx='1'/%3E%3Crect x='14' y='3' width='7' height='7' rx='1'/%3E%3Crect x='3' y='14' width='7' height='7' rx='1'/%3E%3Crect x='14' y='14' width='7' height='7' rx='1'/%3E%3C/svg%3E\")";

export function buildLookCss(look: CatalogLook, primary?: string): string {
  const css: string[] = [];
  const R = '.ecommerce';

  const bg = safeHex(look.bgColor, '#ffffff');
  const from = safeHex(look.gradientFrom, '#c7d2fe');
  const to = safeHex(look.gradientTo, '#fbcfe8');
  const dark = (look.bgType ?? 'fill') === 'fill' || look.bgType === 'pattern' ? isDarkColor(bg) : false;

  // Paleta: la del tema si vino; si no, derivada del fondo.
  const text = safeHex(look.textColor, dark ? '#e6e9f2' : '#111827');
  const muted = safeHex(look.mutedColor, dark ? '#94a3b8' : '#6b7280');
  const surface = look.surfaceColor && HEX.test(look.surfaceColor) ? look.surfaceColor : dark ? `color-mix(in srgb, ${bg} 90%, #ffffff)` : '#ffffff';
  const border = look.borderColor && HEX.test(look.borderColor) ? look.borderColor : dark ? `color-mix(in srgb, ${bg} 78%, #ffffff)` : '#e8e8ec';
  const hasPalette = !!(look.textColor || look.surfaceColor || dark || look.bgColor);

  // Paneles (modal de producto, carrito, tarjetas del checkout): sólidos. Si el
  // texto del tema es claro, el panel es una versión oscura del fondo; así el
  // color principal (que puede ser blanco) siempre se lee.
  const lightText = !isDarkColor(text);
  const panel = look.panelColor && HEX.test(look.panelColor) ? look.panelColor : lightText ? `color-mix(in srgb, ${bg} 82%, #000000)` : '#ffffff';
  const panelText = lightText ? text : '#111827';
  const panelMuted = lightText ? muted : '#6b7280';
  const panelBorder = lightText ? 'rgba(255,255,255,0.14)' : '#e5e7eb';
  // Variables en :root porque el modal de producto se monta fuera de .ecommerce.
  css.push(`:root, ${R} { --lk-bg: ${bg}; --lk-surface: ${surface}; --lk-border: ${border}; --lk-text: ${text}; --lk-muted: ${muted}; --lk-panel: ${panel}; --lk-panel-text: ${panelText}; --lk-panel-muted: ${panelMuted}; --lk-panel-border: ${panelBorder}; }`);

  // ── Fondo ────────────────────────────────────────────────────────────
  switch (look.bgType ?? 'fill') {
    case 'fill':
      if (look.bgColor) css.push(`${R} { background: var(--lk-bg) !important; }`);
      break;
    case 'gradient':
      {
        const via = look.gradientVia && HEX.test(look.gradientVia) ? `${look.gradientVia}, ` : '';
        css.push(`${R} { background: linear-gradient(170deg, ${from}, ${via}${to}) !important; }`);
      }
      break;
    case 'blur':
      css.push(`${R} { background: radial-gradient(circle at 15% 10%, ${from}, transparent 55%), radial-gradient(circle at 85% 60%, ${to}, transparent 55%), ${bg} !important; }`);
      break;
    case 'pattern': {
      // Las líneas usan el color del texto (se ven en claros y oscuros).
      // Cada propiedad lleva !important: el shorthand `background` del
      // componente pisaba background-image/size.
      const c = 'color-mix(in srgb, var(--lk-text) 16%, transparent)';
      const patterns: Record<string, [string, string]> = {
        dots: [`radial-gradient(${c} 0.1rem, transparent 0.11rem)`, '0.9rem 0.9rem'],
        grid: [`linear-gradient(${c} 0.0625rem, transparent 0.0625rem), linear-gradient(90deg, ${c} 0.0625rem, transparent 0.0625rem)`, '1.1rem 1.1rem'],
        diagonal: [`repeating-linear-gradient(45deg, ${c} 0 0.125rem, transparent 0.125rem 0.75rem)`, 'auto'],
        waves: [`radial-gradient(circle at 50% 0, transparent 0.5rem, ${c} 0.56rem, transparent 0.64rem)`, '1.25rem 0.75rem'],
      };
      const [img, size] = patterns[look.pattern ?? 'dots'] ?? patterns['dots'];
      css.push(`${R} { background-color: var(--lk-bg) !important; background-image: ${img} !important; background-size: ${size} !important; background-repeat: repeat !important; }`);
      break;
    }
    case 'image': {
      const url = safeUrl(look.bgImage);
      const dim = Math.min(70, Math.max(0, look.bgDim ?? 25)) / 100;
      css.push(url
        ? `${R} { background: linear-gradient(rgba(0,0,0,${dim}), rgba(0,0,0,${dim})), url("${url}") center / cover no-repeat !important; }`
        : `${R} { background: var(--lk-bg) !important; }`);
      break;
    }
    case 'video':
      // El <video> lo monta el shell (fijo detrás del contenido).
      css.push(safeUrl(look.bgVideo) ? `html, body, ${R} { background: transparent !important; }` : `${R} { background: var(--lk-bg) !important; }`);
      break;
  }

  if (hasPalette || (look.bgType && look.bgType !== 'fill')) {
    // Todo el lienzo comparte el fondo: la cabecera (nombre, descripción) NO
    // es un bloque de otro color; solo las tarjetas de producto se separan.
    css.push(`${R} .ecommerce__content, ${R} .catalog, ${R} .category-filter-nav,
${R} .category-filter, ${R} .p-tablist, ${R} .p-tablist-content, ${R} .p-tablist-tab-list, ${R} .p-tab,
${R} .catalog-footer { background: transparent !important; }
${R} { color: var(--lk-text) !important; }
${R} .hero__card { background: transparent !important; box-shadow: none !important; border: 0 !important; }
${R} .hero__name, ${R} .catalog-footer__name, ${R} .catalog__featured-title { color: var(--lk-text) !important; }
${R} .hero__location, ${R} .hero__hours, ${R} .hero__description, ${R} .hero__prose, ${R} .catalog-footer, ${R} .catalog-footer__copyright { color: var(--lk-muted) !important; }
${R} .hero__description-toggle { background: transparent !important; background-image: none !important; box-shadow: none !important; }
${R} .hero__description-wrap .hero__description-toggle { position: static !important; display: block; width: fit-content; margin: 0.25rem 0 0 auto; padding: 0 !important; }
${R} .hero__card-more, ${R} .product-card__wholesale-tag { color: var(--lk-on-primary) !important; }
${R} .p-tab { color: var(--lk-muted) !important; }
${R} .p-tab[data-p-active="true"], ${R} .p-tab-active { color: var(--color-primary-500) !important; }
${R} .p-tablist-tab-list { padding-inline-end: 2.25rem !important; }
${R} .p-tablist-nav-button, ${R} .p-tablist-prev-button, ${R} .p-tablist-next-button { background: transparent !important; background-image: none !important; box-shadow: none !important; color: var(--lk-text) !important; }
${R} .p-tablist-nav-button::before, ${R} .p-tablist-nav-button::after { display: none !important; }
${R} .category-filter-icon-btn { color: var(--lk-text) !important; }
${R} .ecommerce__action-btn { background: var(--lk-surface) !important; color: var(--lk-text) !important; border: 0.0625rem solid var(--lk-border) !important; }
${R} .product-card { background: var(--lk-surface) !important; border: 0.0625rem solid var(--lk-border) !important; box-shadow: none !important; color: var(--lk-text) !important; }
${R} .product-card__title, ${R} .product-card__title-link, ${R} .product-card__price, ${R} .product-card__price-current, ${R} .product-card__wholesale-tier-price { color: var(--lk-text) !important; }
${R} .product-card__description, ${R} .product-card__wholesale-tier, ${R} .product-card__wholesale-tier-title, ${R} .product-card__sizes-label, ${R} .product-card__price-bs { color: var(--lk-muted) !important; }
${R} .product-card__size-chip { border-color: var(--lk-border) !important; color: var(--lk-text) !important; background: transparent !important; }
${R} .product-card__qty-count { color: var(--lk-text) !important; }`);
  }

  if (hasPalette || (look.bgType && look.bgType !== 'fill')) {
    // Aro del logo: como en el tema claro (aro del color del fondo que lo
    // separa del banner), pero con los colores del tema + un filo sutil.
    // En fondos oscuros el aro del color del fondo se pierde: ahí se tiñe con
    // el color principal para que el logo siga resaltando.
    const ring = lightText ? 'color-mix(in srgb, var(--color-primary-500) 55%, var(--lk-bg))' : 'var(--lk-bg)';
    css.push(`${R} .hero__logo, ${R} .hero__logo-placeholder { border-color: ${ring} !important; box-shadow: 0 0 0 0.0625rem var(--lk-border), 0 0.25rem 0.75rem rgba(0, 0, 0, 0.18) !important; background-color: var(--lk-bg) !important; }`);
    if (look.brutal) {
      css.push(`${R} .hero__logo, ${R} .hero__logo-placeholder { border-color: var(--lk-text) !important; box-shadow: 0.2rem 0.2rem 0 var(--lk-text) !important; }`);
    }

    // Estado abierto/cerrado legible sobre fondos oscuros o degradados.
    if (lightText) {
      css.push(`${R} .hero__status--closed { color: #fecaca !important; }
${R} .hero__status--open { color: #bbf7d0 !important; }`);
    }
    css.push(`${R} .hero__subtitle, ${R} .hero__hours { color: var(--lk-muted) !important; }
${R} .cart-drawer__checkout-count { background: var(--lk-on-primary) !important; color: var(--color-primary-600) !important; }
html .pdm__category { color: var(--lk-panel-muted) !important; }`);

    // Precio promocional / original tachado.
    css.push(`${R} .product-card__price-promo { color: var(--lk-text) !important; }
${R} .product-card__price-original { color: var(--lk-muted) !important; opacity: 0.85; }`);

    // Modal de producto (se abre en un p-dialog fuera de .ecommerce).
    css.push(`html .p-dialog:has(.pdm), html .p-dialog:has(.pdm) .p-dialog-content, html .pdm, html .pdm__gallery, html .pdm__info, html .pdm__footer, html .pdm__handle { background: var(--lk-panel) !important; color: var(--lk-panel-text) !important; }
html .pdm__name, html .pdm__price, html .pdm__total, html .pdm__tier-price, html .pdm__qty-value, html .pdm__selected-option { color: var(--lk-panel-text) !important; }
html .pdm__category, html .pdm__categories, html .pdm__description, html .pdm__prose, html .pdm__price-original, html .pdm__tier-title, html .pdm__tiers-label, html .pdm__sizes-label, html .pdm__qty-label, html .pdm .text-grey-500, html .pdm .text-grey-700, html .pdm .text-grey-900 { color: var(--lk-panel-muted) !important; }
html .pdm__tier, html .pdm__size-pill, html .pdm__quantity-selector, html .pdm__qty-btn { border-color: var(--lk-panel-border) !important; background: transparent !important; color: var(--lk-panel-text) !important; }
html .pdm__footer { border-top: 0.0625rem solid var(--lk-panel-border) !important; box-shadow: none !important; }
html .pdm__add-btn, html .pdm__tier-btn { background: var(--color-primary-500) !important; color: var(--lk-on-primary) !important; border: 0 !important; }
html .pdm__size-pill.pdm__size-pill--selected { background: var(--color-primary-500) !important; border-color: var(--color-primary-500) !important; color: var(--lk-on-primary) !important; }
html .pdm__add-btn *, html .pdm__tier-btn * { color: inherit !important; }
html .pdm__prose * { color: inherit !important; }
${R} .cart-item__size strong { color: inherit !important; }
html .pdm__overlay-more { background: linear-gradient(to right, transparent, var(--lk-panel) 1.25rem) !important; color: var(--color-primary-500) !important; }`);

    // Modal "Más sobre…" (info del catálogo): panel del tema; acentos con el
    // texto del panel (el color principal puede ser blanco y no leerse).
    {
      const ok = lightText ? '#86efac' : '#16a34a';
      const bad = lightText ? '#fca5a5' : '#dc2626';
      const okBg = lightText ? 'rgba(134,239,172,0.14)' : '#dcfce7';
      const badBg = lightText ? 'rgba(252,165,165,0.14)' : '#fee2e2';
      const tint = 'color-mix(in srgb, var(--lk-panel-text) 7%, transparent)';
      // Acento = color principal si se lee sobre el panel; si no, el texto del panel.
      const lum = (h: string) => { const n = parseInt(h.slice(1, 7), 16); return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255); };
      const p = primary && HEX.test(primary) ? primary : '';
      const accent = p && (lightText ? lum(p) > 120 : lum(p) < 175) ? p : 'var(--lk-panel-text)';
      const onAccent = accent === p ? 'var(--lk-on-primary)' : 'var(--lk-panel)';
      css.push(`html .info-modal { background: var(--lk-panel) !important; color: var(--lk-panel-text) !important; }
html .info-modal :is(.info-modal__title, .info-modal__panel-header, .info-modal__social-link, .info-modal__hours-day) { color: var(--lk-panel-text) !important; }
html .info-modal :is(.info-modal__status, .info-modal__status-text, .info-modal__description, .info-modal__hours-time, .info-modal__chevron, .info-modal__social-arrow) { color: var(--lk-panel-muted) !important; }
html .info-modal :is(.info-modal__status, .info-modal__status-header) { background: ${tint} !important; }
html .info-modal :is(.info-modal__panel, .info-modal__hours tr) { border-color: var(--lk-panel-border) !important; }
html .info-modal__close { background: ${accent} !important; color: ${onAccent} !important; }
html .info-modal__status--open { color: ${ok} !important; }
html .info-modal__status--closed, html .info-modal__hours-closed { color: ${bad} !important; }
html .info-modal__day-badge--open { background: ${okBg} !important; color: ${ok} !important; }
html .info-modal__day-badge--closed { background: ${badBg} !important; color: ${bad} !important; }
html .info-modal__hours-row--today { background: ${tint} !important; }
html .info-modal__hours-row--today .info-modal__hours-day { color: var(--lk-panel-text) !important; font-weight: 600; }
html .info-modal__social-link svg, html .info-modal__panel-title ui-icon, html .info-modal__panel-title svg { color: ${accent} !important; }
html .info-modal__social-link:hover { background: ${tint} !important; }
html .info-modal__prose a { color: var(--lk-panel-text) !important; text-decoration: underline; }`);
    }

    // Carrito.
    css.push(`${R} .cart-drawer__panel, ${R} .cart-drawer__header, ${R} .cart-drawer__footer, ${R} .cart-drawer__content { background: var(--lk-panel) !important; color: var(--lk-panel-text) !important; border-color: var(--lk-panel-border) !important; }
${R} .cart-drawer__title, ${R} .cart-drawer__back, ${R} .cart-item__name, ${R} .cart-item__price, ${R} .cart-drawer__empty-title { color: var(--lk-panel-text) !important; }
${R} .cart-drawer__panel :is(p, span, strong, h4, small, div) { color: inherit; }
${R} .cart-drawer__panel .cart-item__description, ${R} .cart-drawer__panel .cart-item__size, ${R} .cart-drawer__empty-subtitle, ${R} .cart-drawer__clear { color: var(--lk-panel-muted) !important; }
${R} .cart-item { background: transparent !important; border-color: var(--lk-panel-border) !important; }
${R} .cart-item__qty-btn { border-color: var(--lk-panel-border) !important; color: var(--lk-panel-text) !important; background: transparent !important; }
${R} .cart-drawer__checkout-btn { background: var(--color-primary-500) !important; color: var(--lk-on-primary) !important; }`);

    // Checkout: lo que va sobre el fondo del tema usa el texto del tema; las
    // tarjetas usan el panel.
    css.push(`${R} .checkout__heading, ${R} .checkout__business, ${R} .checkout__back, ${R} .checkout__topbar, ${R} .checkout__submit-hint, ${R} .checkout__post-title { color: var(--lk-text) !important; }
${R} .checkout__post-subtitle, ${R} .checkout__country { color: var(--lk-muted) !important; }
${R} .checkout__card, ${R} .checkout__summary { background: var(--lk-panel) !important; color: var(--lk-panel-text) !important; border-color: var(--lk-panel-border) !important; }
${R} .checkout__card-title, ${R} .checkout__label, ${R} .checkout__item-name, ${R} .checkout__item-price, ${R} .checkout__ship-name, ${R} .checkout__summary-row, ${R} .checkout__summary-total { color: var(--lk-panel-text) !important; }
${R} .checkout__ship-desc, ${R} .checkout__ship-fee, ${R} .checkout__link { color: var(--lk-panel-muted) !important; }
${R} .checkout__ship-item, ${R} .checkout__pay-chip { border-color: var(--lk-panel-border) !important; background: transparent !important; color: var(--lk-panel-text) !important; }
${R} .checkout__wa:not(:disabled), ${R} .checkout__submit:not(:disabled) { background: var(--color-primary-500) !important; color: var(--lk-on-primary) !important; border-color: var(--color-primary-500) !important; }
${R} .checkout__wa:disabled, ${R} .checkout__submit:disabled { background: color-mix(in srgb, var(--lk-text) 22%, transparent) !important; color: var(--lk-text) !important; opacity: 0.7 !important; }`);
  }

  // Tarjetas tipo vidrio sobre fondos no planos.
  if (look.bgType && look.bgType !== 'fill' && look.glassCards) {
    // La transparencia la da el propio surfaceColor (#rrggbbaa).
    // Vidrio líquido (estilo Apple): desenfoque + saturación, borde de luz
    // y brillo interior. La transparencia la da el surfaceColor.
    // OJO rendimiento: backdrop-filter en TODAS las tarjetas (decenas) sobre un
    // fondo grande hacía caer la pestaña (GPU) en Chrome, sobre todo dentro del
    // iframe escalado del editor. El desenfoque real va solo en los pocos
    // botones flotantes; las tarjetas simulan el vidrio con transparencia,
    // borde de luz y brillo interior (sin blur).
    const glass = `${R} .ecommerce__action-btn, ${R} .ecommerce__cart-pill, ${R} .hero__card-more`;
    css.push(`${glass} { background-color: color-mix(in srgb, var(--lk-surface) 85%, transparent); }
${R} .product-card { background: color-mix(in srgb, var(--lk-surface) 85%, transparent) !important; border: 0.0625rem solid rgba(255,255,255,0.35) !important; box-shadow: inset 0 0.0625rem 0 rgba(255,255,255,0.45), inset 0 -0.0625rem 0 rgba(255,255,255,0.08), 0 0.5rem 1.75rem rgba(0,0,0,0.16) !important; }
${R} .ecommerce__action-btn, ${R} .ecommerce__cart-pill { box-shadow: inset 0 0.0625rem 0 rgba(255,255,255,0.5), 0 0.35rem 1rem rgba(0,0,0,0.18) !important; }`);
  }

  // Estilo bloque (neo-brutalista): borde grueso + sombra desplazada sólida.
  if (look.brutal) {
    css.push(`${R} .product-card { border: 0.125rem solid var(--lk-text) !important; box-shadow: 0.25rem 0.25rem 0 var(--lk-text) !important; border-radius: 0.35rem !important; }
${R} .product-card__add-full-btn, ${R} .ecommerce__cart-pill { border: 0.125rem solid var(--lk-text) !important; box-shadow: 0.2rem 0.2rem 0 var(--lk-text) !important; }`);
  }

  // ── Fuente y texto ───────────────────────────────────────────────────
  if (look.font && LOOK_FONTS.includes(look.font)) {
    css.push(`${R}, ${R} button, ${R} input, html .pdm, html .pdm button { font-family: '${look.font}', var(--font-family, 'Inter'), sans-serif !important; }`);
  }
  if (look.textScale && look.textScale !== 100) {
    // Los componentes usan rem (relativo a <html>), así que cambiar el
    // font-size de .ecommerce no alcanza. `zoom` en los contenedores de TEXTO
    // escala letras y espacios sin tocar fotos ni banner.
    const scale = Math.min(120, Math.max(85, look.textScale)) / 100;
    css.push(`${R} .hero__card-body, ${R} .category-filter-nav, ${R} .product-card__content, ${R} .catalog__featured-title, ${R} .catalog-footer, html .pdm__info { zoom: ${scale}; }`);
  }
  if (look.headingStyle === 'serif') {
    css.push(`${R} .product-card__title, ${R} .hero__name { font-family: 'Playfair Display', serif !important; }`);
  } else if (look.headingStyle === 'bold') {
    css.push(`${R} .product-card__title, ${R} .hero__name { font-weight: 800 !important; }`);
  }

  // ── Botones ──────────────────────────────────────────────────────────
  const btn = `${R} .product-card__add-full-btn`;
  const pill = `${R} .ecommerce__cart-pill`;
  const onPrimary = 'var(--lk-on-primary, #ffffff)';
  if (look.buttonShape) {
    const radius = { square: '0.2rem', rounded: '0.55rem', pill: '999rem' }[look.buttonShape];
    css.push(`${btn}, ${pill} { border-radius: ${radius} !important; }`);
  }
  if (look.buttonSize) {
    const size = {
      sm: 'padding: 0.45rem 0.75rem !important; font-size: 0.8125rem !important;',
      md: 'padding: 0.65rem 0.9rem !important; font-size: 0.875rem !important;',
      lg: 'padding: 0.875rem 1rem !important; font-size: 0.9375rem !important;',
    }[look.buttonSize];
    css.push(`${btn} { ${size} }`);
  }
  if (look.buttonStyle === 'outline') {
    css.push(`${btn} { background: transparent !important; color: var(--color-primary-500) !important; border: 0.094rem solid var(--color-primary-500) !important; }
${pill} { background: var(--lk-surface) !important; color: var(--color-primary-500) !important; border: 0.094rem solid var(--color-primary-500) !important; }`);
  } else if (look.buttonStyle === 'soft') {
    css.push(`${btn} { background: color-mix(in srgb, var(--color-primary-500) 14%, transparent) !important; color: var(--color-primary-600) !important; border: 0 !important; }`);
  } else if (look.buttonStyle === 'solid') {
    css.push(`${btn}, ${pill} { background: var(--color-primary-500) !important; color: ${onPrimary} !important; border: 0.094rem solid var(--color-primary-500) !important; }`);
  }
  // Botones flotantes de arriba (favorito, compartir, chat): mismo estilo de
  // botón del tema. Van opacos porque se apoyan sobre el banner.
  const act = `${R} .ecommerce__action-btn`;
  if (look.buttonStyle === 'outline') {
    css.push(`${act} { background: var(--lk-bg) !important; color: var(--color-primary-500) !important; border: 0.094rem solid var(--color-primary-500) !important; }`);
  } else if (look.buttonStyle === 'soft') {
    css.push(`${act} { background: color-mix(in srgb, var(--color-primary-500) 16%, var(--lk-bg)) !important; color: var(--color-primary-600) !important; border: 0 !important; }`);
  } else if (look.buttonStyle === 'solid') {
    css.push(`${act} { background: var(--color-primary-500) !important; color: ${onPrimary} !important; border: 0 !important; }`);
  }
  if (look.brutal) {
    css.push(`${act} { border: 0.125rem solid var(--lk-text) !important; box-shadow: 0.15rem 0.15rem 0 var(--lk-text) !important; }`);
  }
  if (look.buttonShape === 'square') css.push(`${act} { border-radius: 0.35rem !important; }`);

  if (look.buttonShadow) {
    css.push(`${btn}, ${pill} { box-shadow: 0 0.35rem 0.9rem color-mix(in srgb, var(--color-primary-500) 30%, transparent) !important; }`);
  }

  // ── Productos ────────────────────────────────────────────────────────
  // Columnas en teléfono: "hasta N". Cada tarjeta tiene un ancho mínimo; si
  // no caben N, se muestran menos (la tarjeta conserva su forma). Los
  // destacados muestran N visibles y el resto sigue con scroll horizontal.
  const cols = { grid2: 2, grid3: 3, grid4: 4 }[look.productLayout as 'grid2' | 'grid3' | 'grid4'];
  if (cols && cols > 2) {
    const min = cols === 4 ? '6.75rem' : '7.5rem';
    css.push(`@media (max-width: 47.99rem) {
  ${R} .catalog__products--grid { grid-template-columns: repeat(auto-fill, minmax(max(${min}, calc((100% - ${cols - 1} * 0.75rem) / ${cols})), 1fr)) !important; }
  ${R} .product-card__description { display: none; }
  ${R} .catalog__featured-row { grid-auto-columns: max(${min}, calc((100% - ${cols - 1} * 0.75rem) / ${cols} - 0.75rem)) !important; }
}`);
  } else if (look.productLayout === 'list') {
    // Lista: foto a la izquierda; nombre, precio y botón a la derecha.
    css.push(`@media (max-width: 47.99rem) {
  ${R} .catalog__products--grid { grid-template-columns: minmax(0, 1fr) !important; gap: 0.6rem !important; }
  ${R} .catalog__products--grid .product-card { display: grid !important; grid-template-columns: 8.5rem minmax(0, 1fr); gap: 0.85rem; padding: 0.65rem !important; align-items: stretch; }
  ${R} .catalog__products--grid .product-card__image { aspect-ratio: 1 !important; height: auto !important; border-radius: 0.6rem; }
  ${R} .catalog__products--grid .product-card__content { padding: 0 !important; display: flex; flex-direction: column; justify-content: center; min-width: 0; }
  ${R} .catalog__products--grid .product-card__title { -webkit-line-clamp: 2; }
  ${R} .catalog__products--grid .product-card__description { -webkit-line-clamp: 1; }
  ${R} .catalog__products--grid .product-card__image { border-radius: 0.75rem; }
  ${R} .catalog__products--grid .product-card__actions { margin-top: auto; display: flex; justify-content: flex-end; }
  ${R} .catalog__products--grid .product-card__add-full-btn { width: auto !important; min-width: 7.5rem; padding: 0.5rem 1rem !important; font-size: 0.8125rem !important; }
  ${R} .catalog__products--grid .product-card__quantity { width: 8.5rem !important; margin-left: auto; }
}`);
  }
  if (look.cardStyle === 'flat') {
    css.push(`${R} .product-card { border-color: transparent !important; background: transparent !important; }`);
  } else if (look.cardStyle === 'border') {
    css.push(`${R} .product-card { background: transparent !important; }`);
  }
  if (look.showPrice === false) css.push(`${R} .product-card__price { display: none !important; }`);
  if (look.showStockBadge === false) css.push(`${R} .product-card__sold-out-tag { display: none !important; }`);

  // OJO: NO usar mask-image sobre .p-tablist-content (contenedor con scroll +
  // barra animada): hacía caer el hilo Compositor de Chrome/Arc (SIGTRAP) al
  // cargar el editor. Tampoco backdrop-filter masivo ni transform en el iframe.
  // ── Skeletons (carga) con los colores del tema ──────────────────────
  {
    const a = 'color-mix(in srgb, var(--lk-text, #111827) 8%, transparent)';
    const b = 'color-mix(in srgb, var(--lk-text, #111827) 16%, transparent)';
    const shimmer = `background: linear-gradient(90deg, ${a} 25%, ${b} 50%, ${a} 75%) !important; background-size: 200% 100% !important;`;
    css.push(`${R} .catalog__skeleton-card { background: var(--lk-surface, #fff) !important; border-color: var(--lk-border, #eee) !important; }
${R} :is(.catalog__skeleton-image, .catalog__skeleton-title, .catalog__skeleton-desc, .catalog__skeleton-price, .catalog__skeleton-btn, .catalog__category-pill-skeleton, .catalog__search-skeleton, .hero__name-skeleton, .hero__logo-skeleton, .catalog-header__title-skeleton, .catalog-header__search-skeleton, .catalog-header__cart-skeleton) { ${shimmer} }`);
    if (look.brutal) css.push(`${R} .catalog__skeleton-card { border: 0.125rem solid var(--lk-text) !important; box-shadow: 0.25rem 0.25rem 0 var(--lk-text) !important; }`);
  }

  // ── Estados vacíos ("No hay productos", carrito vacío) ───────────────
  // Título con el color de texto del tema y descripción con buen contraste
  // (el gris fijo no se leía sobre fondos oscuros o degradados).
  css.push(`${R} .catalog__empty-title { color: var(--lk-text) !important; }
${R} .catalog__empty-subtitle { color: color-mix(in srgb, var(--lk-text) 78%, transparent) !important; }
${R} .catalog__empty-bubble { background: color-mix(in srgb, var(--lk-text) 9%, transparent) !important; color: var(--lk-text) !important; }
${R} .catalog__empty-bubble::before { border-color: color-mix(in srgb, var(--lk-text) 30%, transparent) !important; }
${R} .catalog__empty-bubble :is(svg, ui-icon) { color: var(--lk-text) !important; }
${R} .cart-drawer__empty-title { color: var(--lk-panel-text) !important; }
${R} .cart-drawer__empty-subtitle { color: color-mix(in srgb, var(--lk-panel-text) 78%, transparent) !important; }
${R} .cart-drawer__empty-bubble { background: color-mix(in srgb, var(--lk-panel-text) 9%, transparent) !important; color: var(--lk-panel-text) !important; }
${R} .cart-drawer__empty-bubble::before { border-color: color-mix(in srgb, var(--lk-panel-text) 30%, transparent) !important; }
${R} .cart-drawer__empty-bubble :is(svg, ui-icon) { color: var(--lk-panel-text) !important; }
${R} .cart-drawer__empty-cta { background: var(--color-primary-500) !important; color: var(--lk-on-primary, #fff) !important; }`);

  // ── Categorías: chips / pestañas / íconos ───────────────────────────
  // `html body` extra: el CSS del componente usa ::ng-deep con !important.
  const cf = `html body ${R} .category-filter`;
  if (look.categoryStyle === 'chips') {
    css.push(`${cf} .p-tablist-active-bar { display: none !important; }
${cf} .p-tablist-tab-list { gap: 0.5rem; border: 0 !important; padding: 0.35rem 0 !important; }
${cf} .p-tab { border: 0.0625rem solid var(--lk-border, #e5e7eb) !important; border-radius: 999rem !important; padding: 0.4rem 0.95rem !important; background: var(--lk-surface, #fff) !important; color: var(--lk-text, #111827) !important; text-transform: none !important; font-size: 0.8125rem !important; white-space: nowrap; }
${cf} .p-tab[data-p-active="true"], ${cf} .p-tab.p-tab-active { background: var(--color-primary-500) !important; border-color: var(--color-primary-500) !important; color: var(--lk-on-primary, #fff) !important; border-radius: 999rem !important; }`);
  } else if (look.categoryStyle === 'icons') {
    css.push(`${cf} .p-tablist-active-bar { display: none !important; }
${cf} .p-tablist-tab-list { gap: 0.35rem; border: 0 !important; padding: 0.25rem 0 !important; }
${cf} .p-tab { display: flex !important; flex-direction: column; align-items: center; gap: 0.3rem; border: 0 !important; background: transparent !important; padding: 0.2rem 0.35rem !important; text-transform: none !important; font-size: 0.72rem !important; max-width: 5.25rem; white-space: nowrap; color: var(--lk-text, #111827) !important; }
${cf} .p-tab::before { content: attr(data-initial); display: grid; place-items: center; width: 3.1rem; height: 3.1rem; border-radius: 50%; background: color-mix(in srgb, var(--color-primary-500) 14%, var(--lk-surface, #fff)); color: var(--color-primary-600); font-weight: 700; font-size: 1.15rem; border: 0.125rem solid transparent; box-sizing: border-box; }
${cf} .p-tab[data-p-active="true"]::before, ${cf} .p-tab.p-tab-active::before { background: var(--color-primary-500); color: var(--lk-on-primary, #fff); border-color: color-mix(in srgb, var(--color-primary-500) 40%, #fff); }
${cf} .p-tab[data-p-active="true"], ${cf} .p-tab.p-tab-active { font-weight: 700 !important; }
${cf} .p-tab[data-all] { position: relative; }
${cf} .p-tab[data-all]::before { content: '' !important; }
${cf} .p-tab[data-all]::after { content: ''; position: absolute; top: 0.2rem; left: 50%; width: 3.1rem; height: 3.1rem; transform: translateX(-50%); background: var(--color-primary-600); -webkit-mask: ${GRID_ICON} center / 1.35rem no-repeat; mask: ${GRID_ICON} center / 1.35rem no-repeat; pointer-events: none; }
${cf} .p-tab[data-all][data-p-active="true"]::after, ${cf} .p-tab[data-all].p-tab-active::after { background: var(--lk-on-primary, #fff); }`);
  }

  // ── Pie de página ────────────────────────────────────────────────────
  if (look.footerSocial === false) css.push(`${R} .catalog-footer__social { display: none !important; }`);
  if (look.footerHours === false) css.push(`${R} .catalog-footer__location-row { display: none !important; }`);

  // ── Botones principales en todo el recorrido ─────────────────────────
  // "Ver más" de la cabecera, "Ir a pagar" del carrito, "Agregar" del modal y
  // "Realizar pedido" del checkout comparten forma, sombra y estilo bloque con
  // los botones del catálogo, para que todo se vea igual.
  // El selector de cantidad (− 1 +) de la tarjeta sigue la misma forma.
  const qty = `${R} .product-card__quantity`;
  if (look.buttonShape) {
    const r = { square: '0.2rem', rounded: '0.55rem', pill: '999rem' }[look.buttonShape];
    css.push(`${qty} { border-radius: ${r} !important; overflow: hidden; }`);
  }
  if (look.brutal) css.push(`${qty} { border: 0.125rem solid var(--lk-text) !important; box-shadow: 0.2rem 0.2rem 0 var(--lk-text) !important; }`);
  const ctaPage = `${R} .hero__card-more`;
  const ctaPanel = `${R} .cart-drawer__checkout-btn, ${R} .checkout__wa:not(:disabled), ${R} .checkout__submit:not(:disabled), html .pdm__add-btn, html .pdm__tier-btn`;
  if (look.buttonShape) {
    const radius = { square: '0.2rem', rounded: '0.55rem', pill: '999rem' }[look.buttonShape];
    css.push(`${ctaPage}, ${ctaPanel}, ${R} .checkout__wa, ${R} .checkout__submit { border-radius: ${radius} !important; }`);
  }
  if (look.brutal) {
    css.push(`${ctaPage} { border: 0.125rem solid var(--lk-text) !important; box-shadow: 0.2rem 0.2rem 0 var(--lk-text) !important; }
${ctaPanel} { border: 0.125rem solid var(--lk-panel-text) !important; box-shadow: 0.2rem 0.2rem 0 var(--lk-panel-text) !important; }`);
  } else if (look.buttonShadow) {
    css.push(`${ctaPage}, ${ctaPanel} { box-shadow: 0 0.35rem 0.9rem color-mix(in srgb, var(--color-primary-500) 30%, transparent) !important; }`);
  }

  return css.join('\n');
}

/** Color de texto legible sobre el color principal (para botones rellenos). */
export function onPrimaryColor(primary: string): string {
  return isDarkColor(primary) ? '#ffffff' : '#111827';
}
