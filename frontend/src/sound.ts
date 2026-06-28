// Minimal Web Audio beeper — no asset files. The AudioContext is created on the
// first user gesture (starting a timer) so mobile browsers allow playback.
let ctx: AudioContext | null = null;

export function initAudio() {
  if (!ctx) {
    const Ctor = window.AudioContext || (window as any).webkitAudioContext;
    if (Ctor) ctx = new Ctor();
  }
  if (ctx && ctx.state === "suspended") ctx.resume();
}

function tone(freq: number, durationMs: number, type: OscillatorType = "sine", gain = 0.18) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.value = gain;
  osc.connect(g);
  g.connect(ctx.destination);
  const now = ctx.currentTime;
  osc.start(now);
  // Quick fade out to avoid clicks.
  g.gain.setValueAtTime(gain, now + durationMs / 1000 - 0.02);
  g.gain.linearRampToValueAtTime(0.0001, now + durationMs / 1000);
  osc.stop(now + durationMs / 1000);
}

/** Short countdown tick (3-2-1). */
export const tick = () => tone(660, 120, "sine");
/** The "GO" at the top of a minute / start of a work interval. */
export const go = () => tone(990, 320, "square", 0.2);
/** Transition into a rest interval. */
export const rest = () => tone(440, 220, "sine");
/** Workout complete fanfare. */
export function finish() {
  tone(660, 160);
  setTimeout(() => tone(880, 160), 160);
  setTimeout(() => tone(1175, 360), 320);
}

export function vibrate(ms: number | number[]) {
  if (navigator.vibrate) navigator.vibrate(ms);
}
