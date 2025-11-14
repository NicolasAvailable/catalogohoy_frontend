import { assert } from '@shared/domain';

export class Audio {
  constructor(private readonly element: HTMLAudioElement) {}

  public get isPlaying(): boolean {
    return !this.isPaused;
  }

  public get isPaused(): boolean {
    return this.element.paused;
  }

  public get isEnded(): boolean {
    return this.element.ended;
  }

  public get isMuted(): boolean {
    return this.element.muted;
  }

  public get duration(): number {
    return this.element.duration || 0;
  }

  public get currentTime(): number {
    return this.element.currentTime;
  }

  public get progress(): number {
    if (!this.duration) return 0;
    return (this.currentTime / this.duration) * 100;
  }

  public set currentTime(time: number) {
    assert(time >= 0 && time <= this.duration, 'Current time must be between 0 and duration');
    this.element.currentTime = time;
  }

  public get volume(): number {
    return this.element.volume;
  }

  public set volume(value: number) {
    assert(value >= 0 && value <= 1, 'Volume must be between 0 and 1');
    this.element.volume = value;
  }

  public get formattedCurrentTime(): string {
    return Audio.formatTime(this.currentTime);
  }

  public get formattedDuration(): string {
    return Audio.formatTime(this.duration);
  }

  public get formattedTime(): string {
    return `${this.formattedCurrentTime} / ${this.formattedDuration}`;
  }

  public play(): Promise<void> {
    return this.element.play();
  }

  public pause(): void {
    this.element.pause();
  }

  public toggle(): Promise<void> | void {
    return this.isPlaying ? this.pause() : this.play();
  }

  public seekTo(time: number): void {
    assert(time >= 0 && time <= this.duration, 'Current time must be between 0 and duration');
    this.currentTime = time;
  }

  public seekToPercentage(percentage: number): void {
    assert(percentage >= 0 && percentage <= 1, 'Percentage must be between 0 and 1');
    this.currentTime = (this.duration * percentage) / 100;
  }

  public mute(): void {
    this.element.muted = true;
  }

  public unmute(): void {
    this.element.muted = false;
  }

  public toggleMute(): void {
    this.element.muted = !this.element.muted;
  }

  public reset(): void {
    this.pause();
    this.currentTime = 0;
  }

  public load(): void {
    this.element.load();
  }

  public onPlay(callback: () => void): void {
    this.element.addEventListener('play', callback);
  }

  public onPause(callback: () => void): void {
    this.element.addEventListener('pause', callback);
  }

  public onEnded(callback: () => void): void {
    this.element.addEventListener('ended', callback);
  }

  public onTimeUpdate(callback: () => void): void {
    this.element.addEventListener('timeupdate', callback);
  }

  public onLoadedMetadata(callback: () => void): void {
    this.element.addEventListener('loadedmetadata', callback);
  }

  public removeEventListener(event: string, callback: () => void): void {
    this.element.removeEventListener(event, callback);
  }

  public static formatTime(seconds: number): string {
    if (isNaN(seconds) || !isFinite(seconds)) {
      return '0:00';
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  }
}
