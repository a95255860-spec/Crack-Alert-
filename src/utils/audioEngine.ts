import { SeverityLevel } from '../types/shm';

class AcousticAudioEngine {
  private ctx: AudioContext | null = null;
  private lastPlayedAt = 0;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playAlert(severity: SeverityLevel, enabled: boolean): void {
    if (!enabled || severity === 'normal') return;
    const nowMs = Date.now();
    // Rate-limit audio alerts so rapid serial streams remain clear and non-jarring
    if (nowMs - this.lastPlayedAt < (severity === 'alarm' ? 650 : 1200)) return;
    this.lastPlayedAt = nowMs;

    const ctx = this.ensureContext();
    if (!ctx) return;

    const t0 = ctx.currentTime;

    if (severity === 'alarm') {
      // Aerospace dual-pulse piezo alarm tone (1480 Hz -> 1960 Hz)
      [0, 0.14].forEach((offset, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(idx === 0 ? 1480 : 1960, t0 + offset);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2800, t0 + offset);

        gain.gain.setValueAtTime(0.0001, t0 + offset);
        gain.gain.exponentialRampToValueAtTime(0.09, t0 + offset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + offset + 0.11);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.start(t0 + offset);
        osc.stop(t0 + offset + 0.12);
      });
    } else if (severity === 'suspicious') {
      // Subtle single diagnostic ping (880 Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, t0);
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.045, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.2);
    }
  }
}

export const acousticAudio = new AcousticAudioEngine();
