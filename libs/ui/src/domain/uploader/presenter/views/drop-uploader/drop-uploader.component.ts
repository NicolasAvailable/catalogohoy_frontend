import { Component, contentChild, effect, input, output, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FileUploadItemComponent, FileUploadZoneComponent } from '../../components';
import { Uploader, UploaderList } from '../../../domain';
import { PickerTemplate, UploaderOutput, UploaderComponent } from '../uploader/uploader.component';

@Component({
  selector: 'ui-drop-uploader',
  imports: [CommonModule, UploaderComponent, FileUploadItemComponent, FileUploadZoneComponent],
  template: `
    <ui-uploader
      #uploader
      (valueChange)="valueChange.emit($event)"
      (idleChange)="idleChange.emit($event)"
      [multiple]="multiple()"
      [accept]="accept()"
      [autoUpload]="autoUpload()"
      [disabled]="disabled()"
      [max]="max()"
      class="block size-full"
    >
      <ng-template #picker let-uploaderList let-fileList="fileList" let-pick="pick" let-paste="paste" let-canPaste="canPaste">
        <section class="size-full absolute inset-0" [ngClass]="{ 'pointer-events-none': disabled() }">
          @for(uploader of uploaderList.items; track $index) {
          <ui-file-upload-item (remove)="remove(uploader)" [uploader]="uploader" [removable]="removable()" />
          }@empty {
          <ui-file-upload-zone [styleClass]="styleClass()">
            <ng-container *ngTemplateOutlet="pickerTemplate(); context: { $implicit: uploaderList, pick, paste, canPaste }" />
          </ui-file-upload-zone>
          }
        </section>
      </ng-template>
    </ui-uploader>
  `,
})
export class DropUploaderComponent {
  public readonly multiple = input<boolean>(false);
  public readonly accept = input<string>('image/*');
  public readonly autoUpload = input<boolean>(true);
  public readonly disabled = input<boolean>(false);
  public readonly max = input<{ mb: number | undefined }>({ mb: undefined });
  public readonly removable = input<boolean>(false);
  public readonly styleClass = input<string>();

  public readonly idleChange = output<UploaderList>();
  public readonly valueChange = output<UploaderOutput>();

  public readonly uploader = viewChild.required<UploaderComponent>('uploader');
  public readonly pickerTemplate = contentChild.required<PickerTemplate>('picker');

  public pick = () => {
    this.uploader().pick();
  };

  public upload(): Promise<void> {
    return this.uploader().upload();
  }

  public remove(uploader: Uploader) {
    this.uploader().uploaderList().mutable.remove(uploader);
    this.idleChange.emit(this.uploader().uploaderList());
  }
}
