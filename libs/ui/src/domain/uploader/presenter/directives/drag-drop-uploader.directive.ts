import { Directive, ElementRef, HostListener, input, output, Renderer2 } from '@angular/core';
import { E } from '@shared/domain';

export type DragDropUploaderOutput = E.Either<Error, FileList>;

@Directive({ selector: '[uiDragDropUploader]' })
export class DragDropUploaderDirective {
  public readonly disabled = input<boolean>(false);

  public readonly valueChange = output<DragDropUploaderOutput>();
  public readonly dragOver = output<boolean>();

  constructor(private elementRef: ElementRef, private renderer: Renderer2) {}

  @HostListener('dragenter', ['$event'])
  onDragEnter(event: DragEvent): void {
    if (this.disabled()) return;

    event.preventDefault();
    event.stopPropagation();

    this.dragOver.emit(true);
    this.renderer.addClass(this.elementRef.nativeElement, 'drag-over');
  }

  @HostListener('dragover', ['$event'])
  onDragOver(event: DragEvent): void {
    if (this.disabled()) return;

    event.preventDefault();
    event.stopPropagation();
  }

  @HostListener('dragleave', ['$event'])
  onDragLeave(event: DragEvent): void {
    if (this.disabled()) return;

    event.preventDefault();
    event.stopPropagation();

    if (!event.relatedTarget || !this.elementRef.nativeElement.contains(event.relatedTarget)) {
      this.dragOver.emit(false);
      this.renderer.removeClass(this.elementRef.nativeElement, 'drag-over');
    }
  }

  @HostListener('drop', ['$event'])
  onDrop(event: DragEvent): void {
    if (this.disabled()) return;

    event.preventDefault();
    event.stopPropagation();

    this.dragOver.emit(false);
    this.renderer.removeClass(this.elementRef.nativeElement, 'drag-over');

    const files = event.dataTransfer?.files;

    if (!files || files.length === 0) return;

    this.valueChange.emit(E.right(files));
  }
}
