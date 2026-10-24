/**
 * All Arrow Math sounds are synthesised with the Web Audio API. There are no
 * audio files to load, so the app works completely offline.
 */

type OscillatorKind = OscillatorType;

interface ToneOptions {
  frequency: number;
  endFrequency?: number;
  duration: number;
  delay?: number;
  gain?: number;
  type?: OscillatorKind;
  attack?: number;
  vibrato?: { rate: number; depth: number };
}

class AudioEngine {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(muted ? 0 : 0.22, now, 0.015);
  }

  get isMuted(): boolean {
    return this.muted;
  }

  private ensure(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.context) {
      const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextClass) return null;
      this.context = new AudioContextClass();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.22;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      // An unhandled rejection here (e.g. an autoplay policy hold) would be a
      // console error on the very first pointer interaction.
      this.context.resume().catch(() => {});
    }

    return this.context;
  }

  private tone(options: ToneOptions): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    const {
      frequency,
      endFrequency,
      duration,
      delay = 0,
      gain = 0.16,
      type = 'sine',
      attack = 0.008,
      vibrato,
    } = options;

    const start = ctx.currentTime + delay;
    const stop = start + duration;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(Math.max(20, frequency), start);

    if (endFrequency) {
      oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), stop);
    }

    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), start + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, stop);
    oscillator.connect(envelope);
    envelope.connect(this.master);

    let lfo: OscillatorNode | null = null;
    let lfoGain: GainNode | null = null;
    if (vibrato) {
      lfo = ctx.createOscillator();
      lfoGain = ctx.createGain();
      lfo.frequency.value = vibrato.rate;
      lfoGain.gain.value = vibrato.depth;
      lfo.connect(lfoGain);
      lfoGain.connect(oscillator.frequency);
      lfo.start(start);
      lfo.stop(stop);
    }

    oscillator.start(start);
    oscillator.stop(stop + 0.02);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      envelope.disconnect();
      lfo?.disconnect();
      lfoGain?.disconnect();
    });
  }

  pickup(): void {
    this.tone({ frequency: 520, endFrequency: 660, duration: 0.045, gain: 0.075, type: 'sine' });
  }

  add(): void {
    this.tone({ frequency: 680, endFrequency: 880, duration: 0.08, gain: 0.12, type: 'sine' });
    this.tone({ frequency: 1040, duration: 0.075, delay: 0.06, gain: 0.07, type: 'sine' });
  }

  click(): void {
    this.tone({ frequency: 430, endFrequency: 320, duration: 0.055, gain: 0.075, type: 'triangle' });
  }

  snap(): void {
    this.tone({ frequency: 620, endFrequency: 990, duration: 0.09, gain: 0.14, type: 'triangle' });
    this.tone({ frequency: 990, endFrequency: 1320, duration: 0.09, delay: 0.06, gain: 0.08, type: 'sine' });
  }

  chain(): void {
    this.tone({ frequency: 660, endFrequency: 880, duration: 0.07, gain: 0.1, type: 'sine' });
    this.tone({ frequency: 880, endFrequency: 1175, duration: 0.08, delay: 0.07, gain: 0.08, type: 'sine' });
  }

  expand(): void {
    this.tone({ frequency: 392, endFrequency: 587, duration: 0.17, gain: 0.1, type: 'sine' });
    this.tone({ frequency: 523, endFrequency: 784, duration: 0.19, delay: 0.04, gain: 0.065, type: 'sine' });
  }

  /** A short slip as one card leaves a stack. */
  peel(): void {
    this.tone({ frequency: 540, endFrequency: 360, duration: 0.075, gain: 0.085, type: 'triangle' });
    this.tone({ frequency: 820, endFrequency: 620, duration: 0.09, delay: 0.035, gain: 0.05, type: 'sine' });
  }

  stack(): void {
    this.tone({ frequency: 587, endFrequency: 392, duration: 0.16, gain: 0.1, type: 'sine' });
    this.tone({ frequency: 784, endFrequency: 523, duration: 0.16, delay: 0.03, gain: 0.06, type: 'sine' });
  }

  /**
   * A rubbery "boing" — 360Hz dips to 180Hz, then rebounds to 240Hz with a
   * little vibrato.
   */
  bounce(): void {
    if (this.muted) return;
    const ctx = this.ensure();
    if (!ctx || !this.master) return;

    const start = ctx.currentTime;
    const oscillator = ctx.createOscillator();
    const envelope = ctx.createGain();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(360, start);
    oscillator.frequency.exponentialRampToValueAtTime(180, start + 0.14);
    oscillator.frequency.exponentialRampToValueAtTime(240, start + 0.34);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(17, start);
    lfoGain.gain.setValueAtTime(26, start);
    lfoGain.gain.exponentialRampToValueAtTime(1, start + 0.42);
    lfo.connect(lfoGain);
    lfoGain.connect(oscillator.frequency);

    envelope.gain.setValueAtTime(0.0001, start);
    envelope.gain.exponentialRampToValueAtTime(0.22, start + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.11, start + 0.16);
    envelope.gain.exponentialRampToValueAtTime(0.0001, start + 0.48);

    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.start(start);
    lfo.start(start);
    oscillator.stop(start + 0.5);
    lfo.stop(start + 0.5);
    oscillator.addEventListener('ended', () => {
      oscillator.disconnect();
      lfo.disconnect();
      lfoGain.disconnect();
      envelope.disconnect();
    });
  }

  remove(): void {
    this.tone({ frequency: 440, endFrequency: 220, duration: 0.09, gain: 0.1, type: 'sine' });
  }

  reset(): void {
    this.tone({ frequency: 880, endFrequency: 330, duration: 0.24, gain: 0.1, type: 'sine' });
  }

  tidy(): void {
    this.tone({ frequency: 523, duration: 0.08, gain: 0.07, type: 'sine' });
    this.tone({ frequency: 659, duration: 0.08, delay: 0.06, gain: 0.07, type: 'sine' });
    this.tone({ frequency: 784, duration: 0.12, delay: 0.12, gain: 0.08, type: 'sine' });
  }
}

export const audio = new AudioEngine();
