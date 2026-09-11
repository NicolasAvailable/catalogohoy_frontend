import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { IconComponent } from '@ui';

/** Forma mínima de la API `BarcodeDetector` (no tipada en el lib DOM). */
interface BarcodeResult {
  rawValue?: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<BarcodeResult[]>;
}
type BarcodeDetectorCtor = new (opts?: {
  formats?: string[];
}) => BarcodeDetectorLike;

/**
 * Escáner de código de barras del POS. Pide permiso de cámara, muestra el video
 * en vivo con un recuadro y detecta el código con la API nativa
 * `BarcodeDetector` (Chrome/Android/Edge y Safari 17+). Cuando el navegador no
 * la soporta —o si el usuario niega la cámara— cae a una entrada manual de
 * SKU/código para no bloquear la venta. (Mejora futura cross-browser: ZXing.)
 *
 * Emite `detected` con el valor crudo del código y `closed` al cerrarse.
 */
@Component({
  selector: 'pos-scanner',
  standalone: true,
  imports: [FormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="scanner-backdrop" (click)="close()">
      <div class="scanner-card" (click)="$event.stopPropagation()">
        <button type="button" class="scanner-close" (click)="close()" aria-label="Cerrar">
          <ui-icon name="x" styleClass="size-5" />
        </button>

        @if (phase() === 'live') {
          <p class="scanner-hint">Ubicá el código de barras dentro del recuadro</p>
        }

        <div class="scanner-stage">
          <!-- El video existe siempre para poder adjuntar el stream; se oculta
               mientras no haya cámara viva. -->
          <video
            #video
            class="scanner-video"
            [class.is-hidden]="phase() !== 'live'"
            playsinline
            muted
          ></video>

          @if (phase() === 'live') {
            <div class="scan-frame">
              <span class="corner tl"></span>
              <span class="corner tr"></span>
              <span class="corner bl"></span>
              <span class="corner br"></span>
              <span class="scan-line"></span>
            </div>
          } @else if (phase() === 'init') {
            <div class="scanner-state">
              <ui-icon name="camera" styleClass="size-8" />
              <p>Pedí permiso de cámara para escanear…</p>
            </div>
          } @else {
            <div class="scanner-state">
              <ui-icon name="camera" styleClass="size-8" />
              <p>
                {{
                  phase() === 'denied'
                    ? 'No pudimos acceder a la cámara. Revisá los permisos o ingresá el código a mano.'
                    : 'Tu navegador no soporta el escaneo por cámara. Ingresá el código a mano.'
                }}
              </p>
            </div>
          }
        </div>

        <!-- Entrada manual: fallback y también atajo para lectores USB (que
             "escriben" el código y mandan Enter). -->
        <form class="scanner-manual" (ngSubmit)="submitManual()">
          <input
            type="text"
            inputmode="numeric"
            [ngModel]="manualCode()"
            (ngModelChange)="manualCode.set($event)"
            name="manualCode"
            placeholder="Ingresá o escaneá el código / SKU"
            autocomplete="off"
            #manual
          />
          <button type="submit" class="scanner-manual-btn" [disabled]="!manualCode().trim()">
            Buscar
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [
    `
      :host {
        position: fixed;
        inset: 0;
        z-index: 60;
      }
      .scanner-backdrop {
        position: absolute;
        inset: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 1rem;
        background: rgba(15, 23, 42, 0.72);
        backdrop-filter: blur(2px);
      }
      .scanner-card {
        position: relative;
        width: min(26rem, 100%);
        background: #1f2430;
        border-radius: 1.25rem;
        padding: 1rem;
        box-shadow: 0 1.5rem 3rem rgba(0, 0, 0, 0.5);
      }
      .scanner-close {
        position: absolute;
        top: 0.75rem;
        right: 0.75rem;
        z-index: 2;
        display: grid;
        place-items: center;
        width: 2rem;
        height: 2rem;
        border-radius: 999px;
        color: #fff;
        background: rgba(255, 255, 255, 0.12);
        cursor: pointer;
      }
      .scanner-close:hover {
        background: rgba(255, 255, 255, 0.22);
      }
      .scanner-hint {
        position: absolute;
        top: 1.25rem;
        left: 50%;
        transform: translateX(-50%);
        z-index: 2;
        margin: 0;
        padding: 0.4rem 0.85rem;
        border-radius: 999px;
        font-size: 0.8rem;
        color: #fff;
        background: rgba(0, 0, 0, 0.6);
        white-space: nowrap;
      }
      .scanner-stage {
        position: relative;
        aspect-ratio: 1 / 1;
        border-radius: 1rem;
        overflow: hidden;
        background: #0b0e14;
        display: grid;
        place-items: center;
      }
      .scanner-video {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }
      .scanner-video.is-hidden {
        display: none;
      }
      .scanner-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 0.6rem;
        padding: 1.5rem;
        text-align: center;
        color: rgba(255, 255, 255, 0.75);
        font-size: 0.9rem;
      }
      .scan-frame {
        position: absolute;
        inset: 18% 16%;
        border-radius: 0.75rem;
      }
      .corner {
        position: absolute;
        width: 1.6rem;
        height: 1.6rem;
        border: 3px solid #fff;
      }
      .corner.tl {
        top: 0;
        left: 0;
        border-right: 0;
        border-bottom: 0;
        border-top-left-radius: 0.6rem;
      }
      .corner.tr {
        top: 0;
        right: 0;
        border-left: 0;
        border-bottom: 0;
        border-top-right-radius: 0.6rem;
      }
      .corner.bl {
        bottom: 0;
        left: 0;
        border-right: 0;
        border-top: 0;
        border-bottom-left-radius: 0.6rem;
      }
      .corner.br {
        bottom: 0;
        right: 0;
        border-left: 0;
        border-top: 0;
        border-bottom-right-radius: 0.6rem;
      }
      .scan-line {
        position: absolute;
        left: 6%;
        right: 6%;
        height: 2px;
        background: #6366f1;
        box-shadow: 0 0 0.75rem #6366f1;
        animation: scan 2s ease-in-out infinite;
      }
      @keyframes scan {
        0%,
        100% {
          top: 8%;
        }
        50% {
          top: 92%;
        }
      }
      @media (prefers-reduced-motion: reduce) {
        .scan-line {
          animation: none;
          top: 50%;
        }
      }
      .scanner-manual {
        display: flex;
        gap: 0.5rem;
        margin-top: 0.85rem;
      }
      .scanner-manual input {
        flex: 1;
        min-width: 0;
        padding: 0.6rem 0.85rem;
        border-radius: 0.7rem;
        border: 1px solid rgba(255, 255, 255, 0.16);
        background: rgba(255, 255, 255, 0.06);
        color: #fff;
        font-size: 0.95rem;
      }
      .scanner-manual input::placeholder {
        color: rgba(255, 255, 255, 0.45);
      }
      .scanner-manual input:focus {
        outline: none;
        border-color: #6366f1;
      }
      .scanner-manual-btn {
        padding: 0 1.1rem;
        border-radius: 0.7rem;
        background: #6366f1;
        color: #fff;
        font-weight: 600;
        cursor: pointer;
      }
      .scanner-manual-btn:disabled {
        opacity: 0.5;
        cursor: default;
      }
    `,
  ],
})
export class PosScanner implements AfterViewInit, OnDestroy {
  /** Valor crudo del código detectado (o el SKU ingresado a mano). */
  readonly detected = output<string>();
  readonly closed = output<void>();

  private readonly videoRef =
    viewChild<ElementRef<HTMLVideoElement>>('video');

  readonly phase = signal<'init' | 'live' | 'denied' | 'unsupported'>('init');
  readonly manualCode = signal('');

  private stream: MediaStream | null = null;
  private detector: BarcodeDetectorLike | null = null;
  private raf = 0;
  private done = false;

  ngAfterViewInit(): void {
    void this.start();
  }

  ngOnDestroy(): void {
    this.stop();
  }

  private async start(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.phase.set('unsupported');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      const video = this.videoRef()?.nativeElement;
      if (!video) return;
      video.srcObject = this.stream;
      await video.play();
      this.phase.set('live');
      this.beginDetection(video);
    } catch {
      this.phase.set('denied');
    }
  }

  private beginDetection(video: HTMLVideoElement): void {
    const BD = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector;
    if (!BD) {
      // Cámara viva pero sin detección automática: el usuario apunta y, si no
      // resuelve, usa la entrada manual. Mantenemos 'live' para mostrar el video.
      return;
    }
    try {
      this.detector = new BD({
        formats: [
          'ean_13',
          'ean_8',
          'upc_a',
          'upc_e',
          'code_128',
          'code_39',
          'itf',
          'codabar',
          'qr_code',
        ],
      });
    } catch {
      this.detector = new BD();
    }
    this.tick(video);
  }

  private tick = (video: HTMLVideoElement): void => {
    if (this.done || this.phase() !== 'live' || !this.detector) return;
    this.detector
      .detect(video)
      .then((codes) => {
        if (this.done) return;
        const raw = codes?.[0]?.rawValue?.trim();
        if (raw) {
          this.emit(raw);
        } else {
          this.raf = requestAnimationFrame(() => this.tick(video));
        }
      })
      .catch(() => {
        if (!this.done) this.raf = requestAnimationFrame(() => this.tick(video));
      });
  };

  submitManual(): void {
    const code = this.manualCode().trim();
    if (code) this.emit(code);
  }

  private emit(code: string): void {
    if (this.done) return;
    this.done = true;
    this.stop();
    this.detected.emit(code);
  }

  close(): void {
    this.done = true;
    this.stop();
    this.closed.emit();
  }

  private stop(): void {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    const video = this.videoRef()?.nativeElement;
    if (video) video.srcObject = null;
  }
}
