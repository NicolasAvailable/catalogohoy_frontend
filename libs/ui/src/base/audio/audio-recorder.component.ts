import { Component, input, output, signal } from '@angular/core';
import { $file } from '@shared/domain';
import { uploaderService } from '@shared/infrastructure';
import { IconComponent } from '../icon';
import { AudioRecorder } from './models/audio-recorder.model';

@Component({
  selector: 'ui-audio-recorder',
  imports: [IconComponent],
  template: `
    <section class="bg-[#E5F4FF] rounded-2xl p-4" [class]="styleClass()">
      <header class="flex items-center justify-center gap-4">
        <img
          src="images/multimedia/audio-recorder.svg"
          alt="audio"
          class="w-40 text-primary-500"
        />
        <span class="text-sm text-primary-500 font-semibold">{{ time() }}</span>
      </header>
      <footer class="flex items-center justify-between mt-4">
        <ui-icon
          (click)="onCancel()"
          name="trash2"
          styleClass="size-5 text-primary-500 cursor-pointer"
        />
        <ui-icon
          (click)="toggle()"
          [name]="recorder.isPaused() ? 'play' : 'pause'"
          styleClass="size-5 text-primary-500 cursor-pointer"
        />
        <ui-icon
          (click)="onComplete()"
          name="arrowUp"
          styleClass="size-5 text-primary-500 cursor-pointer"
        />
      </footer>
    </section>
  `,
})
export class AudioRecorderComponent {
  public readonly styleClass = input<string>('');

  public readonly cancel = output<void>();
  public readonly complete = output<string>();

  public readonly recorder = new AudioRecorder();
  public readonly time = signal('0:00');
  private intervalId: number | null = null;

  public get isRecording(): boolean {
    return this.recorder.isRecording();
  }

  public get isPaused(): boolean {
    return this.recorder.isPaused();
  }

  public get isActive(): boolean {
    return this.recorder.isActive();
  }

  public get isInactive(): boolean {
    return this.recorder.isInactive();
  }

  public async start(): Promise<void> {
    const result = await this.recorder.start();
    result.mapLeft((error: Error) => console.error('Recording error:', error));
    result.mapRight(() => {
      this.intervalId = window.setInterval(
        () => this.time.set(this.recorder.time),
        100
      );
    });
  }

  public toggle(): void {
    this.recorder.isPaused() ? this.recorder.resume() : this.recorder.pause();
  }

  public async onComplete(): Promise<void> {
    this.stopTimer();
    const result = await this.recorder.stop();
    result.mapRight(async (url: string) => {
      const result = await uploaderService
        .fromFile((await $file.from.url(url)) as File)
        .complete();
      result.mapRight((url: string) => this.complete.emit(url));
    });
  }

  private stopTimer(): void {
    if (this.intervalId === null) return;
    clearInterval(this.intervalId);
    this.intervalId = null;
  }

  public onCancel(): void {
    this.stopTimer();
    this.recorder.stop();
    this.cancel.emit();
  }
}
