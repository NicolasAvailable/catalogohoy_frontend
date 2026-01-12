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
}>;

@_.Component({
  selector: 'ui-uploader',
  imports: [CommonModule, DragDropUploaderDirective],
  template: `
    <section uiDragDropUploader (valueChange)="onFilesDropped($event)" [disabled]="isLoading()" class="group size-full relative">
      <form #form>
        <input
          #input
          (change)="onInputChange($event); form.reset()"
          [accept]="accept()"
          [multiple]="multiple()"
          [disabled]="disabled()"
          type="file"
          class="hidden"
        />
      </form>

      <ng-container *ngTemplateOutlet="pickerTemplate(); context: { $implicit: uploaderList(), pick }"
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

  public pick = (): void => {
    this.input().nativeElement.click();
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
        this.valueChange.emit(this.multiple() ? urls : urls[0]);
      }

      sleep(300).then(() => this.uploaderList.set(UploaderList.idle([])));
    });

    this.isLoading.set(false);
  }

  public onInputChange(event: Event): void {
    this.load((event.target as HTMLInputElement).files);
  }

  public onFilesDropped(result: DragDropUploaderOutput): void {
    result.mapRight(async (fileList) => this.load(fileList));
  }
}
