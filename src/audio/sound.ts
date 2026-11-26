let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  freq: number,
  durationSec: number,
  type: OscillatorType,
  gainPeak: number,
  delaySec = 0,
): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const start = ctx.currentTime + delaySec;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);

  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + durationSec);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(start);
  osc.stop(start + durationSec + 0.02);
}

export function playCorrectSound(): void {
  playTone(587.33, 0.08, 'sine', 0.05);
  playTone(880, 0.1, 'sine', 0.04, 0.045);
}

export function playWrongSound(): void {
  playTone(220, 0.12, 'triangle', 0.05);
}

export function playCompleteSound(): void {
  if (typeof Audio !== 'undefined') {
    const audio = new Audio('/sounds/complete.wav');
    audio.volume = 0.6;
    audio.play().catch(() => {
      playTone(523.25, 0.12, 'sine', 0.045, 0);
      playTone(659.25, 0.12, 'sine', 0.045, 0.08);
      playTone(783.99, 0.18, 'sine', 0.05, 0.16);
    });
    return;
  }
  playTone(523.25, 0.12, 'sine', 0.045, 0);
  playTone(659.25, 0.12, 'sine', 0.045, 0.08);
  playTone(783.99, 0.18, 'sine', 0.05, 0.16);
}
