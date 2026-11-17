// Level generation. A level is built backwards from its solution, so it is
// solvable by construction: first a route is drawn from the power plant to
// every house, the wires along those routes are set to match, the rest of the
// grid is filled with decoy wires, and then every turnable wire is spun a
// random amount. The battery is the rotations needed to undo that spin plus a
// slack, so the player can always finish, and finishing fast pays.

import { LEVELS, BATTERY_PER_TURN, DIR, DX, DY, OPPOSITE, PORT_BIT } from './config.js';
import { makeRng, intBelow, shuffled } from './random.js';
import { makeTile, makeGrid, cellIndex, cellXY, inside, computePower, allHousesPowered, rotateMask } from './grid.js';

function popcount(mask) {
  let n = 0;
  while (mask) {
    n += mask & 1;
    mask >>= 1;
  }
  return n;
}

// Which kind and orientation a wire must have so its ports are exactly the
// given mask. Returns null when no wire kind makes that mask (never for the
// masks routes produce: 1, 2, 3 or 4 ports).
function kindForMask(mask) {
  const count = popcount(mask);
  if (count === 1) {
    const dir = [0, 1, 2, 3].find((d) => mask & PORT_BIT[d]);
    return { kind: 'end', orientation: dir };
  }
  if (count === 2) {
    if (mask === 5) return { kind: 'straight', orientation: 0 };
    if (mask === 10) return { kind: 'straight', orientation: 1 };
    const corners = [3, 6, 12, 9];
    return { kind: 'corner', orientation: corners.indexOf(mask) };
  }
  if (count === 3) {
    const tees = [7, 14, 13, 11];
    return { kind: 'tee', orientation: tees.indexOf(mask) };
  }
  return { kind: 'cross', orientation: 0 };
}

function manhattan(a, b, size) {
  const ax = a % size;
  const ay = Math.floor(a / size);
  const bx = b % size;
  const by = Math.floor(b / size);
  return Math.abs(ax - bx) + Math.abs(ay - by);
}

// A winding route from `start` to `goal`: Dijkstra where every step costs a
// little random amount, so the route meanders instead of cutting straight.
// `blocked` is a set of cell indexes the route may not cross; `forbidden` is
// a set it may not end on (other houses). Returns the list of indexes from
// start to goal, or null when no route exists.
function windingRoute(rng, grid, start, goal, blocked, forbidden) {
  const size = grid.size;
  const total = size * size;
  const dist = new Array(total).fill(Infinity);
  const prev = new Array(total).fill(-1);
  const done = new Array(total).fill(false);
  dist[start] = 0;
  for (;;) {
    let best = -1;
    let bestDist = Infinity;
    for (let i = 0; i < total; i += 1) {
      if (!done[i] && dist[i] < bestDist) {
        bestDist = dist[i];
        best = i;
      }
    }
    if (best === -1 || best === goal) break;
    done[best] = true;
    const { x, y } = cellXY(grid, best);
    for (let d = 0; d < 4; d += 1) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (!inside(grid, nx, ny)) continue;
      const nIndex = cellIndex(grid, nx, ny);
      if (blocked.has(nIndex) || done[nIndex]) continue;
      if (forbidden.has(nIndex) && nIndex !== goal) continue;
      const step = 1 + rng() * 2;
      if (dist[best] + step < dist[nIndex]) {
        dist[nIndex] = dist[best] + step;
        prev[nIndex] = best;
      }
    }
  }
  if (!isFinite(dist[goal])) return null;
  const path = [];
  let cur = goal;
  while (cur !== -1) {
    path.push(cur);
    cur = prev[cur];
  }
  return path.reverse();
}

// Build one level. `levelIndex` is 0-based; `seed` makes the level the same
// every time it is built. Returns { grid, battery, parSeconds }.
export function buildLevel(levelIndex, seed) {
  const cfg = LEVELS[levelIndex];
  const rng = makeRng(seed + levelIndex * 7919);
  const size = cfg.size;
  const grid = makeGrid(size);
  const total = size * size;

  // The power plant sits on the border, so its wires have somewhere to go.
  const border = [];
  for (let x = 0; x < size; x += 1) {
    border.push(cellIndex(grid, x, 0), cellIndex(grid, x, size - 1));
  }
  for (let y = 1; y < size - 1; y += 1) {
    border.push(cellIndex(grid, 0, y), cellIndex(grid, size - 1, y));
  }
  const source = border[intBelow(rng, border.length)];
  grid.source = source;
  grid.cells[source] = makeTile('source');

  // Houses: spread out, never next to the plant or each other.
  const houses = [];
  let tries = 0;
  while (houses.length < cfg.houses && tries < 400) {
    tries += 1;
    const pick = intBelow(rng, total);
    if (pick === source) continue;
    if (houses.includes(pick)) continue;
    if (manhattan(pick, source, size) < 3) continue;
    if (houses.some((h) => manhattan(pick, h, size) < 2)) continue;
    houses.push(pick);
  }
  // If the spread rule starved the level, fill the remaining houses anywhere
  // that is not the plant and not already a house.
  while (houses.length < cfg.houses) {
    const pick = intBelow(rng, total);
    if (pick === source || houses.includes(pick)) continue;
    houses.push(pick);
  }
  grid.houses = houses;
  for (const h of houses) grid.cells[h] = makeTile('house');

  // Draw a route to every house and remember which ports each cell on a route
  // must have. Routes may share cells; the ports accumulate.
  const required = new Array(total).fill(0);
  const blocked = new Set();
  const forbidden = new Set(houses);
  for (const house of houses) {
    const path = windingRoute(rng, grid, source, house, blocked, forbidden);
    if (!path) continue;
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const b = path[i + 1];
      const { x: ax, y: ay } = cellXY(grid, a);
      const { x: bx, y: by } = cellXY(grid, b);
      const d = [0, 1, 2, 3].find((dd) => ax + DX[dd] === bx && ay + DY[dd] === by);
      required[a] |= PORT_BIT[d];
      required[b] |= PORT_BIT[OPPOSITE[d]];
    }
  }

  // Set every route cell to the wire that matches its required ports, and
  // remember the solved orientation. The plant and houses keep their kinds.
  const solved = new Array(total).fill(-1);
  for (let i = 0; i < total; i += 1) {
    if (i === source || houses.includes(i)) continue;
    if (required[i] === 0) continue;
    const { kind, orientation } = kindForMask(required[i]);
    grid.cells[i] = makeTile(kind, orientation);
    solved[i] = orientation;
  }

  // The rest of the grid is decoy wire: random kinds, random turns.
  const decoyKinds = ['end', 'straight', 'corner', 'tee', 'cross'];
  for (let i = 0; i < total; i += 1) {
    if (i === source || houses.includes(i)) continue;
    if (required[i] !== 0) continue;
    const kind = decoyKinds[intBelow(rng, decoyKinds.length)];
    const turns = kind === 'straight' ? 2 : kind === 'cross' ? 1 : 4;
    grid.cells[i] = makeTile(kind, intBelow(rng, turns));
  }

  // Rubble goes only on decoy cells, never on a route.
  let placed = 0;
  let rubbleTries = 0;
  while (placed < cfg.blocked && rubbleTries < 200) {
    rubbleTries += 1;
    const pick = intBelow(rng, total);
    if (pick === source || houses.includes(pick)) continue;
    if (required[pick] !== 0) continue;
    if (grid.cells[pick].kind === 'empty') continue;
    grid.cells[pick] = makeTile('empty');
    placed += 1;
  }

  // Spin every turnable wire. A tile that was part of a route remembers how
  // many turns bring it home, so the battery can be counted exactly.
  let distance = 0;
  for (let i = 0; i < total; i += 1) {
    const tile = grid.cells[i];
    const turns = { end: 4, straight: 2, corner: 4, tee: 4, cross: 1 }[tile.kind] || 1;
    if (turns <= 1) continue;
    const spins = intBelow(rng, turns);
    tile.orientation = (tile.orientation + spins) % turns;
    if (solved[i] >= 0) {
      distance += ((solved[i] - tile.orientation) % turns + turns) % turns;
    }
  }
  const battery = (distance + cfg.slack) * BATTERY_PER_TURN;

  // A level that starts already solved is a broken level: spin again until
  // at least one house is dark. The routes still guarantee a solution.
  let guard = 0;
  while (allHousesPowered(grid) && guard < 40) {
    guard += 1;
    for (let i = 0; i < total; i += 1) {
      const tile = grid.cells[i];
      const turns = { end: 4, straight: 2, corner: 4, tee: 4, cross: 1 }[tile.kind] || 1;
      if (turns <= 1) continue;
      tile.orientation = (tile.orientation + 1) % turns;
    }
    computePower(grid);
  }
  computePower(grid);

  // `solved` is the orientation each route wire must have; the game itself
  // never reads it, but the level test uses it to prove the level can be won.
  return { grid, battery, parSeconds: cfg.parSeconds, solved };
}
