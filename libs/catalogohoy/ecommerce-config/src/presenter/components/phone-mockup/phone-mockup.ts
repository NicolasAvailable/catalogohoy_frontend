import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { TranslocoPipe } from '@jsverse/transloco';
import { IconComponent } from '@ui';
import { PreviewMessage } from '../../../domain';

/** Modelos de teléfono para la vista previa (tamaño real de pantalla en px CSS). */
export interface PhoneModel {
  id: string;
  name: string;
  w: number;
  h: number;
  /** Radio de la pantalla (px reales). */
  r: number;
  cutout: 'island' | 'notch' | 'punch' | 'home';
}
export const PHONE_MODELS: PhoneModel[] = [
  { id: 'iphone17pro', name: 'iPhone 17 Pro', w: 402, h: 874, r: 55, cutout: 'island' },
  { id: 'iphone17promax', name: 'iPhone 17 Pro Max', w: 440, h: 956, r: 55, cutout: 'island' },
  { id: 'iphone13', name: 'iPhone 13', w: 390, h: 844, r: 47, cutout: 'notch' },
  { id: 'iphonese', name: 'iPhone SE', w: 375, h: 667, r: 0, cutout: 'home' },
  { id: 'galaxys25', name: 'Samsung Galaxy S25', w: 360, h: 780, r: 36, cutout: 'punch' },
  { id: 'pixel9', name: 'Google Pixel 9', w: 412, h: 923, r: 40, cutout: 'punch' },
  { id: 'galaxya15', name: 'Samsung Galaxy A15', w: 384, h: 832, r: 28, cutout: 'notch' },
];

@Component({
  selector: 'lib-phone-mockup',
  standalone: true,
  imports: [IconComponent, TranslocoPipe],
  templateUrl: './phone-mockup.html',
  styleUrl: './phone-mockup.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PhoneMockupComponent {
  public readonly iframeUrl = input.required<SafeResourceUrl>();
  public readonly isOverlay = input(false);
  public readonly hidden = input(false);
  /** Origen del iframe (para el postMessage del preview en vivo). En web coincide
   *  con window.location.origin; en la app nativa el iframe es cross-origin
   *  (dominio público del catálogo), así que hay que apuntarle su origen real. */
  public readonly targetOrigin = input<string>('');
  /** Marco del preview: teléfono (default) o ventana de navegador de escritorio. */
  public readonly device = input<'mobile' | 'desktop'>('mobile');
  /** URL que se muestra en la barra del marco de escritorio (solo visual). */
  public readonly displayUrl = input<string>('');
  /** Modelo de teléfono (editor de diseño). Sin modelo = marco clásico. */
  public readonly model = input<string | null>(null);
  public readonly close = output<void>();
  /** Fires every time the iframe finishes (re)loading a document. */
  public readonly loaded = output<void>();

  private readonly iframeRef =
    viewChild<ElementRef<HTMLIFrameElement>>('previewIframe');

  public readonly phone = computed(() => PHONE_MODELS.find((m) => m.id === this.model()) ?? null);
  private readonly wrapRef = viewChild<ElementRef<HTMLElement>>('modelWrap');
  private readonly avail = signal({ w: 0, h: 0 });
  /** Escala y medidas del marco para que el teléfono entre en el espacio. */
  public readonly frame = computed(() => {
    const m = this.phone();
    if (!m) return null;
    const side = m.cutout === 'home' ? 14 : 11;
    const top = m.cutout === 'home' ? 62 : 11;
    const { w: aw, h: ah } = this.avail();
    const s = Math.max(0.3, Math.min(0.85, ((ah || 720) - 2 * top - 8) / m.h, ((aw || 420) - 2 * side - 8) / m.w));
    return {
      s,
      side,
      top,
      sw: Math.round(m.w * s),
      sh: Math.round(m.h * s),
      r: Math.round(m.r * s),
      outerR: m.cutout === 'home' ? 44 * s + 14 : Math.round(m.r * s) + side,
    };
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    let ro: ResizeObserver | null = null;
    effect(() => {
      const el = this.wrapRef()?.nativeElement;
      ro?.disconnect();
      if (!el || typeof ResizeObserver === 'undefined') return;
      ro = new ResizeObserver(([e]) => this.avail.set({ w: e.contentRect.width, h: e.contentRect.height }));
      ro.observe(el);
    });
    destroyRef.onDestroy(() => ro?.disconnect());
  }

  onIframeLoad(): void {
    this.loaded.emit();
  }

  sendPreviewMessage(message: PreviewMessage): void {
    const iframe = this.iframeRef()?.nativeElement;
    if (iframe?.contentWindow) {
      iframe.contentWindow.postMessage(
        message,
        this.targetOrigin() || window.location.origin
      );
    }
  }
}
