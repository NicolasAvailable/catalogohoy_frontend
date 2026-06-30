import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import {
  DialogComponent,
  IconComponent,
  SelectComponent,
  SelectItemDirective,
  SelectSelectedItemDirective,
} from '@ui';
import { AiImageService } from '../../../infrastructure';

export type AspectRatio = 'auto' | 'square' | 'landscape' | 'portrait';

/** Estilos de imagen. El `value` se manda a la edge function, que lo traduce a
 *  un descriptor del prompt (la lógica de IA vive server-side). */
const STYLE_OPTIONS: { value: string; label: string; icon: string }[] = [
  { value: 'default', label: 'Predeterminado', icon: 'sparkles' },
  { value: 'product', label: 'Foto de producto', icon: 'camera' },
  { value: 'studio', label: 'Estudio (fondo blanco)', icon: 'lightbulb' },
  { value: 'lifestyle', label: 'Estilo de vida', icon: 'home' },
  { value: 'minimal', label: 'Minimalista', icon: 'minus' },
  { value: 'threeD', label: 'Render 3D', icon: 'package' },
];

/**
 * Modal para generar una imagen de producto con IA (FLUX vía la Edge Function).
 * Permite elegir proporción y estilo, escribir un prompt (con el título/desc del
 * producto como base) y previsualizar el resultado antes de usarlo.
 */
@Component({
  selector: 'lib-image-generator',
  imports: [
    FormsModule,
    IconComponent,
    DialogComponent,
    SelectComponent,
    SelectItemDirective,
    SelectSelectedItemDirective,
  ],
  templateUrl: './image-generator.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ImageGeneratorComponent implements AfterViewInit {
  // Título y descripción (texto plano) del producto, para insertar como base.
  public readonly title = input<string>('');
  public readonly description = input<string>('');
  public readonly closed = output<void>();
  public readonly generated = output<string>();

  private readonly toast = inject(ToastService);
  private readonly ai = inject(AiImageService);

  private readonly dialog = viewChild<DialogComponent>('genDialog');

  public readonly prompt = signal<string>('');
  public readonly processing = signal<boolean>(false);
  /** URL de la imagen generada (preview). Null hasta que se genere una. */
  public readonly generatedUrl = signal<string | null>(null);

  public readonly aspectRatio = signal<AspectRatio>('auto');
  public readonly style = signal<string>('default');
  public readonly styleOptions = STYLE_OPTIONS;
  public readonly aspectOptions: { value: AspectRatio; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'square', label: 'Cuadrada' },
    { value: 'landscape', label: 'Horizontal' },
    { value: 'portrait', label: 'Vertical' },
  ];

  ngAfterViewInit(): void {
    // El componente se crea cuando el padre lo abre (@if): mostramos el diálogo.
    this.dialog()?.show();
  }

  public setPrompt(value: string): void {
    this.prompt.set(value);
  }

  public setAspect(ratio: AspectRatio): void {
    if (!this.processing()) this.aspectRatio.set(ratio);
  }

  public setStyle(value: string | null): void {
    this.style.set(value ?? 'default');
  }

  public insertTitle(): void {
    this.append(this.title());
  }

  public insertDescription(): void {
    this.append(this.description());
  }

  private append(text: string): void {
    const t = (text ?? '').trim();
    if (!t) return;
    this.prompt.update((p) => (p.trim() ? `${p.trim()} ${t}` : t));
  }

  /** El diálogo se cerró (X, máscara o escape): avisamos al padre. */
  public onDialogClose(): void {
    this.closed.emit();
  }

  public cancel(): void {
    if (!this.processing()) this.dialog()?.hide();
  }

  /** Confirma el uso de la imagen generada: el padre la agrega y cierra. */
  public useImage(): void {
    const url = this.generatedUrl();
    if (url && !this.processing()) this.generated.emit(url);
  }

  public async generate(): Promise<void> {
    const prompt = this.prompt().trim();
    if (prompt.length < 3 || this.processing()) return;
    this.processing.set(true);
    this.toast.wait('Generando imagen con IA…');
    try {
      const result = await this.ai.generate(prompt, {
        aspectRatio: this.aspectRatio(),
        style: this.style(),
      });
      result
        .mapRight((url) => {
          this.toast.success('Imagen generada con IA');
          this.generatedUrl.set(url);
          this.processing.set(false);
        })
        .mapLeft((e) => {
          this.toast.error(new Exception(e.message));
          this.processing.set(false);
        });
    } catch (e) {
      this.toast.dismissWait();
      this.toast.error(
        new Exception(e instanceof Error ? e.message : 'Error al generar')
      );
      this.processing.set(false);
    }
  }
}
