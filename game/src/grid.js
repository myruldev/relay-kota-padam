// The grid model: tiles, their ports, turning them, and the power that flows
// from the source through connected wires to the houses. Nothing here draws
// anything or touches the DOM; it is pure state, so the generator and the
// renderer can both trust it.

import { DIR, DX, DY, OPPOSITE, PORT_BIT, KIND } from './config.js';

// Rotate a port mask one step clockwise: north becomes east, east south, and
// so on. Rotating `steps` times applies the same move repeatedly.
export function rotateMask(mask, steps) {
  let out = mask;
  const n = ((steps % 4) + 4) % 4;
  for (let i = 0; i < n; i += 1) {
    let next = 0;
    for (let d = 0; d < 4; d += 1) {
      if (out & PORT_BIT[d]) next |= PORT_BIT[(d + 1) % 4];
    }
    out = next;
  }
  return out;
}

// A tile is a plain object: { kind, orientation, powered }.
// `orientation` counts clockwise quarter-turns from the kind's base mask.
export function makeTile(kind, orientation = 0) {
  return { kind, orientation, powered: false };
}

// The ports a tile actually has right now, after its orientation.
export function tilePorts(tile) {
  return rotateMask(KIND[tile.kind].base, tile.orientation);
}

// Whether this tile can be turned by the player.
export function isTurnable(tile) {
  return !KIND[tile.kind].fixed && KIND[tile.kind].turns > 1;
}

// Turn a tile one step clockwise. Returns true when it moved.
export function turnTile(tile) {
  if (!isTurnable(tile)) return false;
  tile.orientation = (tile.orientation + 1) % KIND[tile.kind].turns;
  return true;
}

// The grid. `cells` is a flat array, row-major, of tiles. `source` is the
// index of the power plant; `houses` the indexes of the homes.
export function makeGrid(size) {
  const cells = [];
  for (let i = 0; i < size * size; i += 1) cells.push(makeTile('empty'));
  return { size, cells, source: -1, houses: [] };
}

export function cellIndex(grid, x, y) {
  return y * grid.size + x;
}

export function cellXY(grid, index) {
  return { x: index % grid.size, y: Math.floor(index / grid.size) };
}

export function inside(grid, x, y) {
  return x >= 0 && y >= 0 && x < grid.size && y < grid.size;
}

// Recompute which tiles carry power. Power starts at the source and spreads
// through neighbours that face each other with open ports. A house is powered
// when a powered neighbour faces it. Returns the list of powered houses.
export function computePower(grid) {
  for (const cell of grid.cells) cell.powered = false;
  if (grid.source < 0) return [];
  const queue = [grid.source];
  grid.cells[grid.source].powered = true;
  while (queue.length > 0) {
    const index = queue.shift();
    const { x, y } = cellXY(grid, index);
    const ports = tilePorts(grid.cells[index]);
    for (let d = 0; d < 4; d += 1) {
      if (!(ports & PORT_BIT[d])) continue;
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (!inside(grid, nx, ny)) continue;
      const nIndex = cellIndex(grid, nx, ny);
      const neighbour = grid.cells[nIndex];
      if (neighbour.powered) continue;
      if (neighbour.kind === 'empty') continue;
      const nPorts = tilePorts(neighbour);
      if (!(nPorts & PORT_BIT[OPPOSITE[d]])) continue;
      neighbour.powered = true;
      queue.push(nIndex);
    }
  }
  return grid.houses.filter((h) => grid.cells[h].powered);
}

// Every house lit?
export function allHousesPowered(grid) {
  return grid.houses.length > 0 && grid.houses.every((h) => grid.cells[h].powered);
}
