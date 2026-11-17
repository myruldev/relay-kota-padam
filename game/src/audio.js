// All sound is synthesized with WebAudio: no audio files, no network, just
// oscillators and envelopes. The game creates the context on the first user
// gesture (browsers refuse audio before one) and stays silent until then.

let ctx = null;
let muted = false;

function ensureCtx() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  return ctx;
}

export function unlockAudio() {
  const c = ensureCtx();
  if (c && c.state === 'suspended') c.resume();
}

export function setMuted(value) {
  muted = value;
}

export function isMuted() {
  return muted;
}

// One note: an oscillator that slides from `from` to `to` Hz over `dur`
// seconds, fading out, through a gain envelope. `type` is the wave shape.
function note(from, to, dur, type, gain, when = 0) {
  if (muted) return;
  const c = ensureCtx();
  if (!c) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t0 + dur);
  amp.gain.setValueAtTime(0.0001, t0);
  amp.gain.exponentialRampToValueAtTime(gain, t0 + 0.012);
  amp.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(amp);
  amp.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

export const sfx = {
  // A dry click for turning a wire.
  turn() {
    note(740, 520, 0.07, 'square', 0.05);
  },
  // A warm two-note chime when a house lights up.
  houseLit() {
    note(523, 523, 0.12, 'sine', 0.08);
    note(784, 784, 0.18, 'sine', 0.08, 0.07);
  },
  // A rising arpeggio when a level is finished.
  levelClear() {
    [523, 659, 784, 1047].forEach((f, i) => note(f, f, 0.22, 'triangle', 0.09, i * 0.09));
  },
  // A low descending phrase for game over.
  gameOver() {
    [392, 330, 262, 196].forEach((f, i) => note(f, f * 0.94, 0.3, 'sawtooth', 0.05, i * 0.14));
  },
  // A bright fanfare for winning the whole run.
  victory() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => note(f, f, 0.28, 'triangle', 0.09, i * 0.11));
  },
  // A soft blip for moving across a menu.
  select() {
    note(880, 880, 0.06, 'sine', 0.05);
  },
};
