// Everything the player sees, drawn on one canvas: the city grid, the wires
// and their glow, the houses lighting up, the plant, the particles, and the
// screens (title, level clear, game over, victory). The renderer reads the
// game state and draws it; it never changes the state.

import { PALETTE, PORT_BIT } from './config.js';
import { tilePorts, isTurnable } from './grid.js';

// A small burst of sparks. Each particle has a position, a velocity, a life
// and a colour; the game spawns them when a house lights up or a level ends.
export function makeParticles() {
  return [];
}

export function spawnBurst(particles, x, y, colour, count, speed) {
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const v = speed * (0.4 + Math.random() * 0.6);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      life: 0.55 + Math.random() * 0.35,
      age: 0,
      colour,
      size: 2 + Math.random() * 2.5,
    });
  }
}

export function stepParticles(particles, dt) {
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.96;
    p.vy *= 0.96;
    if (p.age >= p.life) particles.splice(i, 1);
  }
}

function drawParticles(ctx, particles) {
  for (const p of particles) {
    const t = 1 - p.age / p.life;
    ctx.globalAlpha = t;
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * t, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// Draw one wire tile inside its cell. `angle` is an extra rotation in
// radians, used to animate a turn. `hot` means the wire carries power.
function drawWire(ctx, cx, cy, r, ports, hot, angle) {
  ctx.save();
  ctx.translate(cx, cy);
  if (angle) ctx.rotate(angle);
  const colour = hot ? PALETTE.wireHot : PALETTE.wire;
  ctx.strokeStyle = colour;
  ctx.lineCap = 'round';
  ctx.lineWidth = r * 0.22;
  if (hot) {
    ctx.shadowColor = PALETTE.wireGlow;
    ctx.shadowBlur = r * 0.55;
  }
  // A short stub from the centre toward each open port.
  for (let d = 0; d < 4; d += 1) {
    if (!(ports & PORT_BIT[d])) continue;
    ctx.beginPath();
    if (d === 0) ctx.moveTo(0, 0), ctx.lineTo(0, -r);
    if (d === 1) ctx.moveTo(0, 0), ctx.lineTo(r, 0);
    if (d === 2) ctx.moveTo(0, 0), ctx.lineTo(0, r);
    if (d === 3) ctx.moveTo(0, 0), ctx.lineTo(-r, 0);
    ctx.stroke();
  }
  // A bright joint in the middle.
  ctx.fillStyle = colour;
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// A little house: a body, a roof and two windows. `lit` decides whether the
// windows glow warm.
function drawHouse(ctx, cx, cy, r, lit) {
  ctx.save();
  ctx.translate(cx, cy);
  if (lit) {
    ctx.shadowColor = PALETTE.houseGlow;
    ctx.shadowBlur = r * 0.9;
  }
  ctx.fillStyle = lit ? PALETTE.houseHot : PALETTE.houseCold;
  // Body.
  ctx.fillRect(-r * 0.52, -r * 0.1, r * 1.04, r * 0.62);
  // Roof.
  ctx.beginPath();
  ctx.moveTo(-r * 0.66, -r * 0.08);
  ctx.lineTo(0, -r * 0.62);
  ctx.lineTo(r * 0.66, -r * 0.08);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  // Windows: dark when the house is cold, bright when it is lit.
  ctx.fillStyle = lit ? '#fff7cc' : '#10182e';
  ctx.fillRect(-r * 0.34, r * 0.08, r * 0.22, r * 0.22);
  ctx.fillRect(r * 0.12, r * 0.08, r * 0.22, r * 0.22);
  ctx.restore();
}

// The power plant: a squat building with a chimney and a pulsing core.
function drawSource(ctx, cx, cy, r, pulse) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.shadowColor = PALETTE.sourceGlow;
  ctx.shadowBlur = r * (0.5 + pulse * 0.35);
  ctx.fillStyle = PALETTE.source;
  ctx.fillRect(-r * 0.55, -r * 0.15, r * 1.1, r * 0.68);
  ctx.fillRect(r * 0.18, -r * 0.62, r * 0.26, r * 0.55);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff3c4';
  const core = r * (0.2 + pulse * 0.06);
  ctx.beginPath();
  ctx.arc(0, r * 0.18, core, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Rubble: a cracked, unusable cell.
function drawRubble(ctx, x, y, cell) {
  ctx.strokeStyle = PALETTE.rubble;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + cell * 0.2, y + cell * 0.75);
  ctx.lineTo(x + cell * 0.45, y + cell * 0.35);
  ctx.lineTo(x + cell * 0.65, y + cell * 0.65);
  ctx.lineTo(x + cell * 0.85, y + cell * 0.3);
  ctx.stroke();
}

// The whole board: the grid, every tile, the particles, and the turn
// animation of the tile the player just clicked (`turning` is { index, from,
// progress } or null).
export function drawBoard(ctx, view, state) {
  const { grid, battery, particles, turning } = state;
  const { x: ox, y: oy, cell } = view;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Board panel.
  const board = cell * grid.size;
  ctx.fillStyle = PALETTE.panel;
  roundRect(ctx, ox - 10, oy - 10, board + 20, board + 20, 14);
  ctx.fill();
  ctx.strokeStyle = PALETTE.panelEdge;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  for (let i = 0; i < grid.cells.length; i += 1) {
    const tile = grid.cells[i];
    const gx = i % grid.size;
    const gy = Math.floor(i / grid.size);
    const x = ox + gx * cell;
    const y = oy + gy * cell;
    const cx = x + cell / 2;
    const cy = y + cell / 2;
    // Cell background and border.
    ctx.fillStyle = PALETTE.cell;
    ctx.fillRect(x + 1, y + 1, cell - 2, cell - 2);
    ctx.strokeStyle = PALETTE.gridLine;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);

    if (tile.kind === 'empty') {
      drawRubble(ctx, x, y, cell);
      continue;
    }
    const r = cell * 0.42;
    let angle = 0;
    if (turning && turning.index === i) {
      angle = turning.progress * (Math.PI / 2);
    }
    if (tile.kind === 'source') {
      drawSource(ctx, cx, cy, r, state.pulse);
    } else if (tile.kind === 'house') {
      drawHouse(ctx, cx, cy, r, tile.powered);
    } else {
      drawWire(ctx, cx, cy, r, tilePorts(tile), tile.powered, angle);
    }
    // A faint ring on turnable tiles, so the player sees what can move.
    if (isTurnable(tile) && !tile.powered) {
      ctx.strokeStyle = 'rgba(142, 160, 194, 0.18)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  drawParticles(ctx, particles);
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
