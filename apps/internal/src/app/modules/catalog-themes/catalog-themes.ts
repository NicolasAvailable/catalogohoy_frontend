import { NgStyle, NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ButtonComponent, IconComponent } from '@ui';
import { toast } from 'ngx-sonner';
import {
  CatalogTheme,
  contrast,
  DEFAULT_THEME_LOOK,
  isHex,
  mainBg,
  onColor,
  slugify,
  THEME_FONTS,
  themeBackground,
  ThemeLook,
} from './catalog-themes.model';
import { CatalogThemesService } from './catalog-themes.service';

type ColorKey = 'bgColor' | 'gradientFrom' | 'gradientVia' | 'gradientTo' | 'surfaceColor' | 'borderColor' | 'textColor' | 'mutedColor';

interface Option<T> {
  value: T;
  label: string;
}

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&family=Playfair+Display:wght@400;600;700&family=Space+Grotesk:wght@400;600;700&family=DM+Serif+Display&family=Nunito:wght@400;700&display=swap';

/**
 * Panel interno → Temas de catálogo. Administra los temas que ven las tiendas
 * en su editor de diseño (tabla `catalog_themes`): crear, editar con vista
 * previa en vivo, duplicar, ocultar, ordenar y borrar.
 */
@Component({
  selector: 'app-catalog-themes',
  standalone: true,
  imports: [FormsModule, NgStyle, NgTemplateOutlet, ButtonComponent, IconComponent],
  host: { class: 'flex-1 min-h-0 flex flex-col' },
  styleUrl: './catalog-themes.css',
  templateUrl: './catalog-themes.html',
})
export class CatalogThemes implements OnInit {
  private readonly service = inject(CatalogThemesService);

  readonly themes = signal<CatalogTheme[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly filter = signal<'all' | 'free' | 'premium' | 'hidden'>('all');

  /** Tema en edición (copia) o null = viendo la lista. */
  readonly draft = signal<CatalogTheme | null>(null);
  readonly isNew = signal(false);
  /** Mientras el id no se toque a mano, sigue al nombre. */
  private idTouched = false;
  readonly isSaving = signal(false);
  readonly confirmDelete = signal(false);

  readonly fonts = THEME_FONTS;
  readonly bgTypes: Option<ThemeLook['bgType']>[] = [
    { value: 'fill', label: 'Color' },
    { value: 'gradient', label: 'Degradado' },
    { value: 'pattern', label: 'Patrón' },
  ];
  readonly patterns: Option<ThemeLook['pattern']>[] = [
    { value: 'dots', label: 'Puntos' },
    { value: 'grid', label: 'Cuadrícula' },
    { value: 'diagonal', label: 'Diagonal' },
    { value: 'waves', label: 'Ondas' },
  ];
  readonly shapes: Option<ThemeLook['buttonShape']>[] = [
    { value: 'square', label: 'Recto' },
    { value: 'rounded', label: 'Redondeado' },
    { value: 'pill', label: 'Píldora' },
  ];
  readonly styles: Option<ThemeLook['buttonStyle']>[] = [
    { value: 'solid', label: 'Relleno' },
    { value: 'outline', label: 'Borde' },
    { value: 'soft', label: 'Suave' },
  ];
  readonly sizes: Option<ThemeLook['buttonSize']>[] = [
    { value: 'sm', label: 'Chico' },
    { value: 'md', label: 'Mediano' },
    { value: 'lg', label: 'Grande' },
  ];
  readonly paletteRows: { key: ColorKey; label: string; hint: string; alpha?: boolean }[] = [
    { key: 'surfaceColor', label: 'Tarjetas', hint: 'Fondo de las tarjetas de producto', alpha: true },
    { key: 'borderColor', label: 'Bordes', hint: 'Borde de tarjetas y botones secundarios', alpha: true },
    { key: 'textColor', label: 'Texto', hint: 'Nombre de la tienda, productos y precios' },
    { key: 'mutedColor', label: 'Texto secundario', hint: 'Descripción, categorías inactivas' },
  ];
  readonly mockProducts = [
    { name: 'Camisa lino', price: '$25' },
    { name: 'Bolso tejido', price: '$40' },
    { name: 'Sandalias', price: '$32' },
    { name: 'Lentes de sol', price: '$18' },
  ];

  readonly counts = computed(() => {
    const t = this.themes();
    return {
      all: t.length,
      free: t.filter((x) => !x.isPremium).length,
      premium: t.filter((x) => x.isPremium).length,
      hidden: t.filter((x) => !x.isActive).length,
    };
  });

  readonly visibleThemes = computed(() => {
    const f = this.filter();
    return this.themes().filter((t) =>
      f === 'free' ? !t.isPremium : f === 'premium' ? t.isPremium : f === 'hidden' ? !t.isActive : true
    );
  });

  readonly idError = computed(() => {
    const d = this.draft();
    if (!d || !this.isNew()) return null;
    if (!/^[a-z0-9][a-z0-9-]{1,39}$/.test(d.id)) return 'Solo minúsculas, números y guiones (2 a 40).';
    if (this.themes().some((t) => t.id === d.id)) return 'Ya existe un tema con este id.';
    return null;
  });

  readonly colorErrors = computed(() => {
    const d = this.draft();
    if (!d) return [] as string[];
    const l = d.look;
    const keys: ColorKey[] = ['surfaceColor', 'borderColor', 'textColor', 'mutedColor'];
    if (l.bgType === 'gradient') keys.push('gradientFrom', 'gradientTo');
    else keys.push('bgColor');
    const bad = keys.filter((k) => !isHex(l[k]));
    if (l.bgType === 'gradient' && l.gradientVia && !isHex(l.gradientVia)) bad.push('gradientVia');
    if (!/^#[0-9a-f]{6}$/i.test(d.color)) bad.push('color' as ColorKey);
    return bad;
  });

  readonly canSave = computed(() => {
    const d = this.draft();
    return !!d && d.name.trim().length > 0 && !this.idError() && this.colorErrors().length === 0 && !this.isSaving();
  });

  /** Avisos de legibilidad (no bloquean el guardado). */
  readonly warnings = computed(() => {
    const d = this.draft();
    if (!d) return [] as string[];
    const l = d.look;
    const bg = mainBg(l);
    const out: string[] = [];
    if (contrast(l.textColor, bg) < 4.5) out.push('El texto se lee poco sobre el fondo.');
    if (contrast(l.mutedColor, bg) < 3) out.push('El texto secundario se lee poco sobre el fondo.');
    if (l.buttonStyle !== 'solid' && contrast(d.color, bg) < 3) out.push('El color principal se pierde sobre el fondo (botones con borde o suaves).');
    return out;
  });

  readonly dirty = computed(() => {
    const d = this.draft();
    if (!d) return false;
    if (this.isNew()) return true;
    const orig = this.themes().find((t) => t.id === d.id);
    return !orig || JSON.stringify(orig) !== JSON.stringify(d);
  });

  async ngOnInit(): Promise<void> {
    this.loadFonts();
    await this.load();
  }

  private loadFonts(): void {
    if (typeof document === 'undefined' || document.getElementById('theme-font-previews')) return;
    const link = document.createElement('link');
    link.id = 'theme-font-previews';
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
  }

  async load(): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);
    const result = await this.service.list();
    result
      .mapRight((rows) => this.themes.set(rows))
      .mapLeft((e) => this.loadError.set(e.message));
    this.isLoading.set(false);
  }

  // ── Lista ──────────────────────────────────────────────────────────────
  newTheme(): void {
    this.idTouched = false;
    this.isNew.set(true);
    this.confirmDelete.set(false);
    this.draft.set({
      id: '',
      name: '',
      color: '#4f46e5',
      look: { ...DEFAULT_THEME_LOOK },
      isPremium: true,
      isActive: true,
      sortOrder: this.themes().length,
      storesUsing: 0,
      updatedAt: null,
    });
  }

  edit(theme: CatalogTheme): void {
    this.idTouched = true;
    this.isNew.set(false);
    this.confirmDelete.set(false);
    this.draft.set(structuredClone(theme));
  }

  duplicate(theme: CatalogTheme): void {
    this.idTouched = false;
    this.isNew.set(true);
    this.confirmDelete.set(false);
    const name = `${theme.name} copia`;
    this.draft.set({ ...structuredClone(theme), name, id: this.uniqueId(slugify(name)), storesUsing: 0, updatedAt: null });
  }

  async move(theme: CatalogTheme, delta: -1 | 1): Promise<void> {
    const list = [...this.themes()];
    const i = list.findIndex((t) => t.id === theme.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= list.length) return;
    [list[i], list[j]] = [list[j], list[i]];
    const prev = this.themes();
    this.themes.set(list);
    const result = await this.service.reorder(list.map((t) => t.id));
    result.mapLeft((e) => {
      this.themes.set(prev);
      toast.error(`No se pudo reordenar: ${e.message}`);
    });
  }

  async toggleActive(theme: CatalogTheme): Promise<void> {
    const next = { ...theme, isActive: !theme.isActive };
    const result = await this.service.save(next, false);
    result
      .mapRight(() => {
        this.themes.update((list) => list.map((t) => (t.id === theme.id ? next : t)));
        toast.success(next.isActive ? `"${theme.name}" visible en el editor` : `"${theme.name}" oculto del editor`);
      })
      .mapLeft((e) => toast.error(e.message));
  }

  // ── Editor ─────────────────────────────────────────────────────────────
  closeEditor(): void {
    this.draft.set(null);
    this.confirmDelete.set(false);
  }

  setName(name: string): void {
    this.patch({ name });
    if (this.isNew() && !this.idTouched) this.patch({ id: this.uniqueId(slugify(name)) });
  }

  setId(id: string): void {
    this.idTouched = true;
    this.patch({ id: id.toLowerCase().trim() });
  }

  patch(p: Partial<CatalogTheme>): void {
    this.draft.update((d) => (d ? { ...d, ...p } : d));
  }

  setLook<K extends keyof ThemeLook>(key: K, value: ThemeLook[K]): void {
    this.draft.update((d) => (d ? { ...d, look: { ...d.look, [key]: value } } : d));
  }

  /** El selector nativo no maneja transparencia: conserva el alfa (#rrggbbAA). */
  pickColor(key: ColorKey, rgb: string): void {
    const cur = this.draft()?.look[key] ?? '';
    const alpha = /^#[0-9a-f]{8}$/i.test(cur) ? cur.slice(7) : '';
    this.setLook(key, `${rgb}${alpha}`);
  }

  typeColor(key: ColorKey, raw: string): void {
    let v = raw.trim().toLowerCase();
    if (v && !v.startsWith('#')) v = `#${v}`;
    this.setLook(key, v);
  }

  colorOf(key: string): string {
    return (this.draft()?.look[key as ColorKey] as string | undefined) ?? '';
  }

  /** Opacidad 0..100 de un color #rrggbb[aa]. */
  opacity(hex: string): number {
    return /^#[0-9a-f]{8}$/i.test(hex) ? Math.round((parseInt(hex.slice(7), 16) / 255) * 100) : 100;
  }

  setOpacity(key: ColorKey, pct: number): void {
    const cur = this.draft()?.look[key] ?? '#ffffff';
    const rgb = cur.slice(0, 7);
    const a = Math.max(0, Math.min(100, Number(pct)));
    this.setLook(key, a >= 100 ? rgb : `${rgb}${Math.round((a / 100) * 255).toString(16).padStart(2, '0')}`);
  }

  setPrimary(raw: string): void {
    let v = raw.trim().toLowerCase();
    if (v && !v.startsWith('#')) v = `#${v}`;
    this.patch({ color: v });
  }

  /** Aplica tarjetas tipo vidrio: tarjeta y borde blancos translúcidos. */
  toggleGlass(): void {
    const d = this.draft();
    if (!d) return;
    const on = !d.look.glassCards;
    this.draft.set({
      ...d,
      look: {
        ...d.look,
        glassCards: on,
        ...(on ? { surfaceColor: '#ffffff1f', borderColor: '#ffffff40' } : { surfaceColor: d.look.surfaceColor.slice(0, 7), borderColor: d.look.borderColor.slice(0, 7) }),
      },
    });
  }

  async save(): Promise<void> {
    const d = this.draft();
    if (!d || !this.canSave()) return;
    this.isSaving.set(true);
    const theme: CatalogTheme = { ...d, name: d.name.trim(), look: this.cleanLook(d.look) };
    const result = await this.service.save(theme, this.isNew());
    this.isSaving.set(false);
    if (result.isLeft()) {
      toast.error(`No se pudo guardar: ${result.value.message}`);
      return;
    }
    toast.success(this.isNew() ? `Tema "${theme.name}" creado` : `Tema "${theme.name}" guardado`);
    this.draft.set(null);
    await this.load();
  }

  async remove(): Promise<void> {
    const d = this.draft();
    if (!d) return;
    this.isSaving.set(true);
    const result = await this.service.remove(d.id);
    this.isSaving.set(false);
    if (result.isLeft()) {
      toast.error(result.value.message);
      return;
    }
    toast.success(`Tema "${d.name}" borrado`);
    this.draft.set(null);
    await this.load();
  }

  // ── Vista previa ───────────────────────────────────────────────────────
  background(look: ThemeLook): Record<string, string> {
    return themeBackground(look);
  }

  onColor(hex: string): string {
    return onColor(hex);
  }

  cardStyle(look: ThemeLook): Record<string, string> {
    const s: Record<string, string> = {
      background: look.surfaceColor,
      border: `0.0625rem solid ${look.borderColor}`,
      color: look.textColor,
    };
    if (look.glassCards) s['backdrop-filter'] = 'blur(0.5rem)';
    if (look.brutal) {
      s['border'] = `0.125rem solid ${look.textColor}`;
      s['box-shadow'] = `0.25rem 0.25rem 0 ${look.textColor}`;
    }
    return s;
  }

  buttonStyle(theme: Pick<CatalogTheme, 'color' | 'look'>, small = false): Record<string, string> {
    const { look, color } = theme;
    const radius = look.buttonShape === 'pill' ? '999px' : look.buttonShape === 'square' ? '0.15rem' : '0.5rem';
    const pad = small ? '0.2rem 0.5rem' : look.buttonSize === 'sm' ? '0.3rem 0.6rem' : look.buttonSize === 'lg' ? '0.6rem 0.9rem' : '0.45rem 0.75rem';
    const s: Record<string, string> = {
      'border-radius': radius,
      padding: pad,
      border: `0.0625rem solid ${color}`,
      background: color,
      color: onColor(color),
    };
    if (look.buttonStyle === 'outline') {
      s['background'] = 'transparent';
      s['color'] = color;
    } else if (look.buttonStyle === 'soft') {
      s['background'] = `color-mix(in srgb, ${color} 18%, transparent)`;
      s['border-color'] = 'transparent';
      s['color'] = contrast(color, mainBg(look)) < 3 ? look.textColor : color;
    }
    if (look.brutal) {
      s['border'] = `0.125rem solid ${look.textColor}`;
      s['box-shadow'] = `0.15rem 0.15rem 0 ${look.textColor}`;
    }
    return s;
  }

  bgLabel(look: ThemeLook): string {
    return look.bgType === 'gradient' ? 'Degradado' : look.bgType === 'pattern' ? 'Patrón' : 'Color';
  }

  private cleanLook(look: ThemeLook): ThemeLook {
    return { ...look, gradientVia: look.gradientVia && isHex(look.gradientVia) ? look.gradientVia : '' };
  }

  private uniqueId(base: string): string {
    const root = base || 'tema';
    const taken = new Set(this.themes().map((t) => t.id));
    if (!taken.has(root)) return root;
    for (let i = 2; ; i++) if (!taken.has(`${root}-${i}`)) return `${root}-${i}`;
  }
}
