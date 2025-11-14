import { Component, computed, effect, ElementRef, input, linkedSignal, signal, viewChild } from '@angular/core';
import { Audio } from './models/audio';
import { IconComponent } from '../icon';

@Component({
  selector: 'ui-audio',
  imports: [IconComponent],
  template: `
    <audio #audioRef [src]="src()" preload="metadata" class="invisible"></audio>
    <section class="w-full grid grid-cols-[auto_1fr_auto] items-center gap-4" [class]="styleClass()">
      <div class="cursor-pointer">
        @if(audio().isPlaying) {
        <ui-icon (click)="audio().pause()" name="pause" styleClass="size-5 text-grey-500"></ui-icon>
        } @else {
        <ui-icon (click)="audio().play()" name="play" styleClass="size-5 text-grey-500"></ui-icon>
        }
      </div>

      <img src="images/multimedia/audio.svg" alt="audio" />

      <span class="text-sm text-grey-300 font-semibold">{{ formattedTime() }}</span>
    </section>
  `,
})
export class AudioComponent {
  public readonly src = input.required<string>();
  public readonly styleClass = input('');

  public readonly audioRef = viewChild.required<ElementRef<HTMLAudioElement>>('audioRef');

  public readonly audio = computed(() => new Audio(this.audioRef().nativeElement));
  public readonly formattedTime = linkedSignal(() => this.audio().formattedTime);

  constructor() {
    effect(() => {
      this.audio().onTimeUpdate(() => {
        this.formattedTime.set(this.audio().formattedTime);
      });
    });
  }
}
