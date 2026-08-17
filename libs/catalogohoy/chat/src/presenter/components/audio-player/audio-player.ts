import {
  Component,
  ElementRef,
  computed,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { IconComponent } from '@ui';

/** Reproductor de notas de voz estilo WhatsApp: play/pausa, barra de progreso
 *  con seek, tiempo y velocidad (1×/1.5×/2×). Variante clara (`onPrimary`)
 *  para burbujas del agente sobre fondo primary.
 *
 *  El progreso se anima con requestAnimationFrame mientras suena — el evento
 *  `timeupdate` del navegador dispara ~4 veces/seg y la barra se veía a saltos. */
@Component({
  selector: 'lib-chat-audio-player',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './audio-player.html',
  styleUrl: './audio-player.css',
})
export class ChatAudioPlayerComponent {
  readonly src = input.required<string>();
  readonly onPrimary = input(false);

  private readonly audioRef =
    viewChild.required<ElementRef<HTMLAudioElement>>('audioEl');

  readonly playing = signal(false);
  readonly currentTime = signal(0);
  readonly duration = signal(0);
  readonly rate = signal(1);

  private rafId: number | null = null;

  readonly progress = computed(() =>
    this.duration() > 0
      ? Math.min(100, (this.currentTime() / this.duration()) * 100)
      : 0
  );

  /** Antes de reproducir muestra la duración total; reproduciendo, el avance. */
  readonly displayTime = computed(() =>
    this.playing() || this.currentTime() > 0
      ? this.currentTime()
      : this.duration()
  );

  toggle(): void {
    const audio = this.audioRef().nativeElement;
    if (audio.paused) {
      audio.playbackRate = this.rate();
      void audio.play();
    } else {
      audio.pause();
    }
  }

  onPlay(): void {
    this.playing.set(true);
    this.stopTicker();
    this.rafId = requestAnimationFrame(this.tick);
  }

  onPause(): void {
    this.playing.set(false);
    this.stopTicker();
    this.syncTime();
  }

  onEnded(): void {
    this.playing.set(false);
    this.stopTicker();
    this.currentTime.set(0);
  }

  /** Avance a 60fps mientras suena — barra fluida, sin saltos. */
  private readonly tick = (): void => {
    this.syncTime();
    if (!this.audioRef().nativeElement.paused) {
      this.rafId = requestAnimationFrame(this.tick);
    }
  };

  private stopTicker(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private syncTime(): void {
    const audio = this.audioRef().nativeElement;
    if (!isFinite(audio.duration)) return;
    this.currentTime.set(audio.currentTime);
    this.duration.set(audio.duration);
  }

  onLoadedMetadata(): void {
    const audio = this.audioRef().nativeElement;
    if (isFinite(audio.duration)) {
      this.duration.set(audio.duration);
      return;
    }
    // Chrome reporta Infinity para .ogg sin duración en el header (los de
    // WhatsApp): saltar al "final" fuerza el cálculo y volvemos al inicio.
    const onChange = () => {
      if (isFinite(audio.duration)) {
        this.duration.set(audio.duration);
        audio.removeEventListener('durationchange', onChange);
        audio.currentTime = 0;
      }
    };
    audio.addEventListener('durationchange', onChange);
    audio.currentTime = 1e101;
  }

  seek(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.audioRef().nativeElement.currentTime = value;
    this.currentTime.set(value);
  }

  cycleRate(): void {
    const next = this.rate() === 1 ? 1.5 : this.rate() === 1.5 ? 2 : 1;
    this.rate.set(next);
    this.audioRef().nativeElement.playbackRate = next;
  }

  format(seconds: number): string {
    if (!isFinite(seconds) || seconds <= 0) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  }
}
