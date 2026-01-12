import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { TranslatePipe } from '@shared/presenter';
import {
  CardComponent,
  IconComponent,
  ProgressBarComponent,
} from '../../../../../base';
import { Uploader } from '../../../domain';

@Component({
  selector: 'ui-file-upload-item',
  imports: [
    CommonModule,
    TranslatePipe,
    IconComponent,
    CardComponent,
    ProgressBarComponent,
  ],
  templateUrl: './file-upload-item.component.html',
})
export class FileUploadItemComponent {
  public readonly uploader = input.required<Uploader>();
  public readonly removable = input<boolean>(false);
  public readonly remove = output<void>();
}
