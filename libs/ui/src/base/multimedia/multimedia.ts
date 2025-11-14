import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { Multimedia } from '@shared/domain';
import { AudioComponent } from '../audio';
import { DocumentPipe } from './pipes';

@Component({
  selector: 'ui-multimedia',
  imports: [CommonModule, DocumentPipe, AudioComponent],
  template: `
    @if(this.isImage()) {
    <img
      [src]="this.url()"
      [class]="'object-cover ' + this.styleClass()"
      [ngClass]="{ error: multimedia().isError() }"
    />
    } @if(this.isVideo()) {
    <video
      (click)="$event.preventDefault()"
      [src]="this.url()"
      [controls]="controls()"
      [class]="this.styleClass()"
      [ngClass]="{ error: multimedia().isError() }"
    ></video>
    } @if(this.isDocument()) {
    <img
      [src]="this.url() | document"
      [class]="'object-cover ' + this.styleClass()"
      [ngClass]="{ error: multimedia().isError() }"
    />
    } @if(this.isAudio()) {
    <ui-audio
      (click)="$event.stopPropagation()"
      [src]="this.url()"
      [class]="this.styleClass()"
      [ngClass]="{ error: multimedia().isError() }"
    />
    }
  `,
})
export class MultimediaComponent {
  public readonly multimedia = input.required<Multimedia>();
  public readonly controls = input(true);
  public readonly styleClass = input('');

  public readonly isImage = computed(() => this.multimedia().isImage());
  public readonly isVideo = computed(() => this.multimedia().isVideo());
  public readonly isAudio = computed(() => this.multimedia().isAudio());
  public readonly isDocument = computed(() => this.multimedia().isDocument());

  public readonly url = computed(() => this.multimedia().url);
}
