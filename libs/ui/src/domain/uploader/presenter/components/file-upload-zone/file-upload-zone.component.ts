import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IconComponent } from '@ui';

@Component({
  selector: 'ui-file-upload-zone',
  imports: [CommonModule, IconComponent],
  templateUrl: './file-upload-zone.component.html',
})
export class FileUploadZoneComponent {
  public readonly styleClass = input<string>();
}
