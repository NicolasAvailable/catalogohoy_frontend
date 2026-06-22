import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { IconComponent } from '@ui';
import { AiImageService } from '../../../infrastructure';

/**
 * Borrador manual estilo Canva/CapCut: el usuario arrastra el pincel sobre lo
 * que quiere quitar y se borra en vivo (queda transparente). Trabaja sobre la
 * imagen actual (idealmente ya pasada por "Quitar fondo"), así que conserva la
 * calidad del recorte de IA y solo elimina lo que el usuario pinta. El borrado
 * es 100% en el canvas del navegador; al aplicar, sube el PNG resultante a
 * Storage y emite la nueva URL.
 */
@Component({
  selector: 'lib-image-eraser',
  imports: [IconComponent],
  templateUrl: './image-eraser.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageEraserComponent {
  public readonly src = input.required<string>();
  public readonly closed = output<void>();
  public readonly applied = output<string>();

  private readonly toast = inject(ToastService);
  private readonly ai = inject(AiImageService);

  private readonly canvasRef =
    viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  // Diámetro del pincel en píxeles del canvas (resolución real de la imagen).
  public readonly brush = signal<number>(50);
  public readonly processing = signal<boolean>(false);
  public readonly ready = signal<boolean>(false);
  // Posición del cursor en píxeles de pantalla (para dibujar el aro del pincel)
  // y diámetro mostrado (escalado al tamaño en pantalla).
  public readonly cursor = signal<{
    x: number;
    y: number;
    d: number;
    show: boolean;
  }>({ x: 0, y: 0, d: 0, show: false });

  private ctx!: CanvasRenderingContext2D;
  private baseImage: ImageData | null = null;
  private undoStack: ImageData[] = [];
  private drawing = false;
  private lastPt: { x: number; y: number } | null = null;

  constructor() {
    afterNextRender(() => this.load());
  }

  private async load(): Promise<void> {
    try {
      const blob = await fetch(this.src()).then((r) => {
        if (!r.ok) throw new Error('No se pudo descargar la imagen');
        return r.blob();
      });
      const bitmap = await createImageBitmap(blob);
      const canvas = this.canvasRef().nativeElement;
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) throw new Error('Canvas no disponible');
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      this.ctx = ctx;
      this.baseImage = ctx.getImageData(0, 0, canvas.width, canvas.height);
      this.brush.set(
        Math.max(20, Math.round(Math.min(canvas.width, canvas.height) * 0.06))
      );
      this.ready.set(true);
    } catch {
      this.toast.error(
        new Exception('No se pudo cargar la imagen para editar')
      );
      this.closed.emit();
    }
  }

  private coords(ev: PointerEvent): {
    x: number;
    y: number;
    dispX: number;
    dispY: number;
    scale: number;
  } {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    const scale = canvas.width / rect.width;
    return {
      x: (ev.clientX - rect.left) * scale,
      y: (ev.clientY - rect.top) * scale,
      dispX: ev.clientX - rect.left,
      dispY: ev.clientY - rect.top,
      scale,
    };
  }

  public onDown(ev: PointerEvent): void {
    if (!this.ready() || this.processing()) return;
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    // Snapshot para deshacer (tope de 12 pasos).
    this.undoStack.push(
      this.ctx.getImageData(0, 0, this.ctx.canvas.width, this.ctx.canvas.height)
    );
    if (this.undoStack.length > 12) this.undoStack.shift();
    this.drawing = true;
    const p = this.coords(ev);
    this.lastPt = { x: p.x, y: p.y };
    this.eraseDot(p.x, p.y);
  }

  public onMove(ev: PointerEvent): void {
    if (!this.ready()) return;
    const p = this.coords(ev);
    this.cursor.set({
      x: p.dispX,
      y: p.dispY,
      d: this.brush() / p.scale,
      show: true,
    });
    if (!this.drawing) return;
    // Traza del pincel: línea con punta redonda en modo "destination-out" =
    // borra (deja transparente) por donde pasa.
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.lineWidth = this.brush();
    this.ctx.strokeStyle = 'rgba(0,0,0,1)';
    this.ctx.beginPath();
    this.ctx.moveTo(this.lastPt!.x, this.lastPt!.y);
    this.ctx.lineTo(p.x, p.y);
    this.ctx.stroke();
    this.ctx.restore();
    this.lastPt = { x: p.x, y: p.y };
  }

  private eraseDot(x: number, y: number): void {
    this.ctx.save();
    this.ctx.globalCompositeOperation = 'destination-out';
    this.ctx.beginPath();
    this.ctx.arc(x, y, this.brush() / 2, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  public onUp(): void {
    this.drawing = false;
    this.lastPt = null;
  }

  public onLeave(): void {
    this.cursor.update((c) => ({ ...c, show: false }));
    this.onUp();
  }

  public setBrush(value: string): void {
    this.brush.set(Number(value));
  }

  public undo(): void {
    const img = this.undoStack.pop();
    if (img) this.ctx.putImageData(img, 0, 0);
  }

  public reset(): void {
    if (this.baseImage) {
      this.ctx.putImageData(this.baseImage, 0, 0);
      this.undoStack = [];
    }
  }

  public cancel(): void {
    if (this.processing()) return;
    this.closed.emit();
  }

  public async apply(): Promise<void> {
    if (!this.ready() || this.processing()) return;
    this.processing.set(true);
    this.toast.wait('Aplicando recorte…');
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        this.canvasRef().nativeElement.toBlob((b) => resolve(b), 'image/png')
      );
      if (!blob) throw new Error('No se pudo exportar la imagen');
      const result = await this.ai.uploadPng(blob);
      result
        .mapRight((url) => {
          this.toast.success('Recorte aplicado');
          this.processing.set(false);
          this.applied.emit(url);
        })
        .mapLeft((e) => {
          this.toast.error(new Exception(e.message));
          this.processing.set(false);
        });
    } catch (e) {
      this.toast.dismissWait();
      this.toast.error(
        new Exception(e instanceof Error ? e.message : 'Error al recortar')
      );
      this.processing.set(false);
    }
  }
}
