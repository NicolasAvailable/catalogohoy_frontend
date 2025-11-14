import { E } from '@shared/domain';

export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime: number = 0;
  private pausedTime: number = 0;
  private totalPausedDuration: number = 0;

  public get time(): string {
    if (!this.startTime) return '0:00';
    const currentTime = Date.now();
    const pausedDuration = this.isPaused() ? currentTime - this.pausedTime : 0;
    const seconds = Math.floor((currentTime - this.startTime - this.totalPausedDuration - pausedDuration) / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  public isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  public isPaused(): boolean {
    return this.mediaRecorder?.state === 'paused';
  }

  public isActive(): boolean {
    return this.isRecording() || this.isPaused();
  }

  public isInactive(): boolean {
    return !this.mediaRecorder || this.mediaRecorder.state === 'inactive';
  }

  public async start(): Promise<E.Either<Error, void>> {
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.mediaRecorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) this.chunks.push(event.data);
      });
      this.mediaRecorder.start();
      this.startTime = Date.now();
      return E.right(undefined);
    } catch (error) {
      return E.left(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public stop(): Promise<E.Either<Error, string>> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder) {
        resolve(E.left(new Error('No active recording')));
        return;
      }
      this.mediaRecorder.addEventListener('stop', () => {
        try {
          const blob = new Blob(this.chunks, { type: 'audio/ogg; codecs=opus' });
          const url = URL.createObjectURL(blob);
          this.cleanup();
          resolve(E.right(url));
        } catch (error) {
          resolve(E.left(error instanceof Error ? error : new Error(String(error))));
        }
      });
      this.mediaRecorder.stop();
    });
  }

  public pause(): E.Either<Error, void> {
    try {
      if (!this.mediaRecorder) return E.left(new Error('No active recording'));
      if (this.mediaRecorder.state !== 'recording') return E.left(new Error('Recording is not active'));
      this.mediaRecorder.pause();
      this.pausedTime = Date.now();
      return E.right(undefined);
    } catch (error) {
      return E.left(error instanceof Error ? error : new Error(String(error)));
    }
  }

  public resume(): E.Either<Error, void> {
    try {
      if (!this.mediaRecorder) return E.left(new Error('No active recording'));
      if (this.mediaRecorder.state !== 'paused') return E.left(new Error('Recording is not paused'));
      this.mediaRecorder.resume();
      this.totalPausedDuration += Date.now() - this.pausedTime;
      this.pausedTime = 0;
      return E.right(undefined);
    } catch (error) {
      return E.left(error instanceof Error ? error : new Error(String(error)));
    }
  }

  private cleanup(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.chunks = [];
    this.mediaRecorder = null;
    this.startTime = 0;
    this.pausedTime = 0;
    this.totalPausedDuration = 0;
  }
}
