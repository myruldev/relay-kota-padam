// Everything tunable about Relay: Kota Padam lives here, so the rest of the
// game reads numbers instead of inventing them.

// The four sides of a tile, clockwise from north. A port mask is one bit per
// side: north 1, east 2, south 4, west 8. The opposite of side d is (d + 2) % 4.
export const DIR = { N: 0, E: 1, S: 2, W: 3 };
export const DX = [0, 1, 0, -1];
export const DY = [-1, 0, 1, 0];
export const OPPOSITE = [2, 3, 0, 1];
export const PORT_BIT = [1, 2, 4, 8];

// Tile kinds. `base` is the port mask at orientation 0; rotating a tile by one
// step clockwise moves every port to the next side. `turns` is how many distinct
// orientations the kind has (a cross looks the same after any turn).
export const KIND = {
  empty: { base: 0, turns: 1, fixed: true },
  source: { base: 15, turns: 1, fixed: true },
  house: { base: 15, turns: 1, fixed: true },
  end: { base: 1, turns: 4, fixed: false },
  straight: { base: 5, turns: 2, fixed: false },
  corner: { base: 3, turns: 4, fixed: false },
  tee: { base: 7, turns: 4, fixed: false },
  cross: { base: 15, turns: 1, fixed: false },
};

// One rotation costs this much battery.
export const BATTERY_PER_TURN = 1;

// The eight levels. `size` is the grid's side, `houses` how many homes need
// power, `blocked` how many cells are rubble that can never carry a wire, and
// `slack` the extra battery on top of the rotations the scramble itself took
// (so every level is solvable by construction, with room to think).
export const LEVELS = [
  { size: 5, houses: 2, blocked: 0, slack: 12, parSeconds: 45 },
  { size: 5, houses: 3, blocked: 0, slack: 12, parSeconds: 60 },
  { size: 6, houses: 3, blocked: 0, slack: 14, parSeconds: 75 },
  { size: 6, houses: 4, blocked: 0, slack: 14, parSeconds: 90 },
  { size: 6, houses: 4, blocked: 2, slack: 14, parSeconds: 100 },
  { size: 7, houses: 4, blocked: 3, slack: 16, parSeconds: 115 },
  { size: 7, houses: 5, blocked: 3, slack: 16, parSeconds: 130 },
  { size: 7, houses: 5, blocked: 4, slack: 16, parSeconds: 150 },
];

export const LEVEL_COUNT = LEVELS.length;

// Scoring. Finishing a level pays a flat amount plus what is left of the
// battery, plus a bonus for beating the par time.
export const SCORE_LEVEL = 100;
export const SCORE_BATTERY = 10;
export const SCORE_TIME_PER_SECOND = 5;

// The palette. One dark city, one warm light: the wires glow cyan when they
// carry power, the houses glow amber when they are lit.
export const PALETTE = {
  page: '#0b1020',
  panel: '#111831',
  panelEdge: '#22305a',
  gridLine: '#1c2947',
  cell: '#0e1526',
  text: '#e6ecf7',
  dimText: '#8ea0c2',
  wire: '#3b4d78',
  wireHot: '#2dd4ee',
  wireGlow: 'rgba(45, 212, 238, 0.55)',
  houseCold: '#5a6c94',
  houseHot: '#fbbf24',
  houseGlow: 'rgba(251, 191, 36, 0.6)',
  source: '#f59e0b',
  sourceGlow: 'rgba(245, 158, 11, 0.55)',
  rubble: '#232c44',
  batteryGood: '#4ade80',
  batteryLow: '#f87171',
  button: '#1d2c52',
  buttonEdge: '#3b5b9e',
};
