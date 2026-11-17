// A tiny seeded random generator (mulberry32) so levels, shuffles and the
// screenshot scenes are the same on every run. The game never reads the wall
// clock for randomness: anything that must vary uses this generator.
export function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Pick an integer in [0, n) from a generator.
export function intBelow(rng, n) {
  return Math.floor(rng() * n);
}

// Fisher-Yates shuffle of a copy of the array, using the given generator.
export function shuffled(rng, items) {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = intBelow(rng, i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}
