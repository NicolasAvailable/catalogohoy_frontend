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
import { Exception } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { ButtonComponent, DialogComponent, IconComponent } from '@ui';
import { AiImageService } from '../../../infrastructure';

/**
 * Modal para generar una imagen de producto con IA (FLUX vía la Edge Function).
 * El usuario escribe un prompt y puede insertar el título/descripción del
 * producto como base. Al generar, sube el resultado a Storage y emite la URL.
 * Usa el ui-dialog compartido (PrimeNG) para verse nativo como el resto.
 */
@Component({
  selector: 'lib-image-generator',
  imports: [IconComponent, DialogComponent, ButtonComponent],
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

  ngAfterViewInit(): void {
    // El componente se crea cuando el padre lo abre (@if): mostramos el diálogo.
    this.dialog()?.show();
  }

  public setPrompt(value: string): void {
    this.prompt.set(value);
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

  public async generate(): Promise<void> {
    const prompt = this.prompt().trim();
    if (prompt.length < 3 || this.processing()) return;
    this.processing.set(true);
    this.toast.wait('Generando imagen con IA…');
    try {
      const result = await this.ai.generate(prompt);
      result
        .mapRight((url) => {
          this.toast.success('Imagen generada con IA');
          this.processing.set(false);
          this.generated.emit(url);
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
