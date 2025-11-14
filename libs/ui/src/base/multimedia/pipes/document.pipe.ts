import { Pipe, PipeTransform } from '@angular/core';
import { Multimedia } from '@shared/domain';

@Pipe({ name: 'document' })
export class DocumentPipe implements PipeTransform {
  private readonly documents = new Map<string, string>();

  constructor() {
    this.documents.set('pdf', 'images/multimedia/file-pdf.svg');
    this.documents.set('xls', 'images/multimedia/file-excel.svg');
    this.documents.set('xlsx', 'images/multimedia/file-excel.svg');
    this.documents.set('csv', 'images/multimedia/file-excel.svg');
    this.documents.set('doc', 'images/multimedia/file-word.svg');
    this.documents.set('docx', 'images/multimedia/file-word.svg');
    this.documents.set('ppt', 'images/multimedia/file-powerpoint.svg');
    this.documents.set('pptx', 'images/multimedia/file-powerpoint.svg');
  }

  transform(url: string): string {
    return this.documents.get(Multimedia.from(url).type) || 'images/multimedia/file-pdf.svg';
  }
}
