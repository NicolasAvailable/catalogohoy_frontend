import { Injectable } from '@angular/core';

/**
 * Reproduce un "ding" corto para avisos in-app (p. ej. una orden nueva).
 *
 * Sintetiza el sonido con la Web Audio API — sin bundlear ningún archivo. Los
 * navegadores bloquean el audio hasta que hay una interacción del usuario
 * (política de autoplay), así que el AudioContext se crea y se reanuda en el
 * primer gesto (click/tecla). Como el admin ya viene interactuando con el panel,
 * para cuando entra una orden el sonido ya está desbloqueado.
 */
@Injectable({ providedIn: 'root' })
export class NotificationSoundService {
  private ctx: AudioContext | null = null;

  constructor() {
    if (typeof document === 'undefined') return;
    const unlock = () => {
      this.ensureContext();
      this.ctx?.resume?.().catch(() => undefined);
    };
    // `once` no sirve: si el primer gesto ocurre con la pestaña en background el
    // resume puede quedar suspendido; reintentamos en cada gesto hasta lograrlo.
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }

  private ensureContext(): void {
    if (this.ctx) return;
    const Ctor: typeof AudioContext | undefined =
      (window as unknown as { AudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (Ctor) this.ctx = new Ctor();
  }

  /** Campanita ascendente de dos notas (C6 → E6) con envolvente suave. */
  play(): void {
    try {
      this.ensureContext();
      const ctx = this.ctx;
      if (!ctx) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => undefined);

      const now = ctx.currentTime;
      const notes = [
        { freq: 1046.5, at: 0 }, // C6
        { freq: 1318.5, at: 0.11 }, // E6
      ];
      for (const note of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = note.freq;
        const start = now + note.at;
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.16, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.34);
        osc.connect(gain).connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.4);
      }
    } catch {
      /* Audio no disponible en este entorno: silencioso, no rompe nada. */
    }
  }
}
