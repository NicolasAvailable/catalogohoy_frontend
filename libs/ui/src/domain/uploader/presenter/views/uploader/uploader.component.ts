import { CommonModule } from '@angular/common';
import * as _ from '@angular/core';
import { assert, Exception, has, is, sleep } from '@shared/domain';
import { ToastService } from '@shared/infrastructure';
import { UploaderFacade } from '../../../application';
import { UploaderList, validator } from '../../../domain';
import {
  DragDropUploaderDirective,
  DragDropUploaderOutput,
} from '../../directives';

export type UploaderOutput = string | string[];
export type PickerTemplate = _.TemplateRef<{
  $implicit: UploaderList;
  pick: VoidFunction;
  /** Programmatic paste — reads images from `navigator.clipboard` so the
   *  template can render a "Pegar imagen" button. Works on mobile (where
   *  Ctrl+V doesn't exist) and triggers the OS permission prompt the first
   *  time the user invokes it. */
  paste: () => Promise<void>;
  /** Truthy when the browser exposes the Clipboard Read API. The template
   *  can use this to hide the paste button on environments that don't
   *  support it (older Firefox, some webviews). */
  canPaste: boolean;
}>;

@_.Component({
  selector: 'ui-uploader',
  imports: [CommonModule, DragDropUploaderDirective],
  template: `
    <section uiDragDropUploader (valueChange)="onFilesDropped($event)" [disabled]="isLoading()" class="group size-full relative">
      <!-- iOS Safari multi-select fix:
           1. Sin wrapper <form> (iOS tiene casos donde el file input
              dentro de un form limita la seleccion a 1).
           2. multiple va como presence-only attribute via attr.multiple,
              no como property binding. Sin esto, iOS 17/18 abre el
              PhotoPicker en single-select.
           3. disabled tambien va como attr para no renderizar
              disabled='false' que Safari puede interpretar como presence. -->
      <input
        #input
        (change)="onInputChange($event); input.value = ''"
        [accept]="accept()"
        [attr.multiple]="multiple() ? '' : null"
        [attr.disabled]="disabled() ? '' : null"
        type="file"
        class="hidden"
      />

      <ng-container *ngTemplateOutlet="pickerTemplate(); context: { $implicit: uploaderList(), pick, paste, canPaste: canUseClipboardApi() }"
      />
    </section>
  `,
})
export class UploaderComponent {
  public readonly multiple = _.input<boolean>(false);
  public readonly accept = _.input<string>('image/*');
  public readonly autoUpload = _.input<boolean>(true);
  public readonly disabled = _.input<boolean>(false);
  public readonly max = _.input<{ mb: number | undefined }>({ mb: undefined });
  /** Listen to `window:paste` and grab images from the clipboard. Off by
   *  default so multiple uploaders on the same page (e.g. logo + banner in
   *  the catalog editor) don't compete for the same paste event. Opt in
   *  from the parent when there's a single primary uploader on the screen
   *  (product save view). */
  public readonly acceptPaste = _.input<boolean>(false);

  public readonly idleChange = _.output<UploaderList>();
  public readonly valueChange = _.output<UploaderOutput>();

  public readonly input =
    _.viewChild.required<_.ElementRef<HTMLInputElement>>('input');
  public readonly pickerTemplate =
    _.contentChild.required<PickerTemplate>('picker');

  public readonly uploaderList = _.signal(UploaderList.empty());
  public readonly isLoading = _.signal(false);

  public readonly toastService = _.inject(ToastService);

  constructor(private readonly uploaderFacade: UploaderFacade) {}

  @_.HostListener('window:paste', ['$event'])
  public onPaste(event: ClipboardEvent): void {
    if (!this.acceptPaste() || this.disabled() || this.isLoading()) return;

    // If the user is typing into a text field, never hijack their paste.
    const target = event.target as HTMLElement | null;
    if (target) {
      const tag = target.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        target.isContentEditable;
      if (isEditable) return;
    }

    const items = event.clipboardData?.items;
    if (!items || items.length === 0) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length === 0) return;

    event.preventDefault();
    event.stopPropagation();

    // Build a synthetic FileList — `load()` accepts FileList, not File[].
    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    this.load(dt.files);
  }

  public pick = (): void => {
    this.input().nativeElement.click();
  };

  /** Returns true when the current browser supports `navigator.clipboard.read()`.
   *  Lets the template hide the "Pegar" button on browsers without support
   *  (older Firefox, some embedded webviews). */
  public canUseClipboardApi(): boolean {
    return typeof navigator !== 'undefined'
      && !!navigator.clipboard
      && typeof navigator.clipboard.read === 'function';
  }

  /** Programmatic paste — invoked from the template's "Pegar imagen" button.
   *  Designed for mobile (no Ctrl+V) and as an explicit alternative on
   *  desktop. Asks the OS for clipboard read permission on first call. */
  public paste = async (): Promise<void> => {
    if (this.disabled() || this.isLoading()) return;

    if (!this.canUseClipboardApi()) {
      this.toastService.error(
        new Exception('Tu navegador no soporta pegar desde el portapapeles. Usa el botón Subir.')
      );
      return;
    }

    let items: ClipboardItem[];
    try {
      items = await navigator.clipboard.read();
    } catch {
      // User denied permission, or there's nothing in the clipboard.
      this.toastService.error(
        new Exception('No se pudo acceder al portapapeles. Asegúrate de copiar una imagen primero.')
      );
      return;
    }

    const files: File[] = [];
    for (const item of items) {
      const imageType = item.types.find((t) => t.startsWith('image/'));
      if (!imageType) continue;
      try {
        const blob = await item.getType(imageType);
        const ext = imageType.split('/')[1] ?? 'png';
        files.push(new File([blob], `pasted-${Date.now()}.${ext}`, { type: imageType }));
      } catch {
        /* skip — item couldn't be read */
      }
    }

    if (files.length === 0) {
      this.toastService.error(
        new Exception('No hay ninguna imagen en el portapapeles.')
      );
      return;
    }

    const dt = new DataTransfer();
    files.forEach((f) => dt.items.add(f));
    this.load(dt.files);
  };

  private load(fileList: FileList | null) {
    if (!fileList) return;
    const result = validator()
      .accept(this.accept())
      .max(this.max().mb)
      .files(Array.from(fileList));
    result.mapLeft((exception) => this.toastService.error(exception));
    result.mapRight(() => {
      this.uploaderList.set(UploaderList.idle(Array.from(fileList)));
      is.affirmative(this.autoUpload())
        .mapRight(() => this.upload())
        .mapLeft(() => this.idleChange.emit(this.uploaderList()));
    });
  }

  public async upload() {
    assert(has(this.uploaderList().length).isRight(), 'No files selected');

    this.isLoading.set(true);
    this.toastService.wait('Subiendo imagen...');

    const result = await this.uploaderFacade.upload({
      files: this.uploaderList().files,
    });
    await result.asyncMap(async (uploaderList) => {
      this.uploaderList.set(uploaderList);
      const results = await Promise.all(
        uploaderList.items.map((output) => output.complete())
      );

      const successResults = results.filter((result) => result.isRight());
      const errorResults = results.filter((result) => !result.isRight());

      errorResults.forEach((result) => {
        const error = result.value;
        if (error instanceof Error) {
          this.toastService.error(new Exception(error.message));
        }
      });

      const urls = successResults.map((result) => result.value as string);

      if (urls.length > 0) {
        this.toastService.success('Subida completa');
        this.valueChange.emit(this.multiple() ? urls : urls[0]);
      }

      sleep(300).then(() => this.uploaderList.set(UploaderList.idle([])));
    });

    this.isLoading.set(false);
    this.toastService.dismissWait();
  }

  public onInputChange(event: Event): void {
    this.load((event.target as HTMLInputElement).files);
  }

  public onFilesDropped(result: DragDropUploaderOutput): void {
    result.mapRight(async (fileList) => this.load(fileList));
  }
}
