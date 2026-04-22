import { Component, input, output } from '@angular/core';
import { IconComponent } from '@ui';
import { CATALOG_TEMPLATES, CatalogTemplate } from '../../../domain';

@Component({
  selector: 'lib-template-selector',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './template-selector.html',
  styleUrl: './template-selector.css',
})
export class TemplateSelectorComponent {
  readonly selected = input<CatalogTemplate>('banner-centered');
  readonly selectedChange = output<CatalogTemplate>();

  readonly templates = CATALOG_TEMPLATES;

  selectTemplate(id: CatalogTemplate): void {
    this.selectedChange.emit(id);
  }
}
