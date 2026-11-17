// Relay: Kota Padam — the game itself. The state machine (title, playing,
// level clear, game over, victory, paused), the turn animation, the battery,
// the score, and the screenshot scenes the maker uses to capture the game.
// All the rules live in grid.js and levels.js; this file only runs them.

import { LEVEL_COUNT, SCORE_LEVEL, SCORE_BATTERY, SCORE_TIME_PER_SECOND, BATTERY_PER_TURN, PALETTE } from './config.js';
import { buildLevel } from './levels.js';
import { computePower, allHousesPowered, isTurnable, turnTile, cellIndex, cellXY } from './grid.js';
import { drawBoard, makeParticles, spawnBurst, stepParticles } from './render.js';
import { buildUI } from './ui.js';
import { makeInput } from './input.js';
import { sfx, unlockAudio, setMuted, isMuted } from './audio.js';

const BEST_KEY = 'relay-kota-padam-best';
const TURN_SECONDS = 0.15;

function readSeed() {
  const params = new URLSearchParams(window.location.search);
  const seed = Number.parseInt(params.get('seed') || '20261117', 10);
  return Number.isFinite(seed) ? seed : 20261117;
}

function readShot() {
  return new URLSearchParams(window.location.search).get('shot') || '';
}

function loadBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) || '0', 10) || 0;
  } catch (err) {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch (err) {
    // A browser that refuses storage still plays fine.
  }
}

const state = {
  screen: 'title',
  levelIndex: 0,
  level: null,
  battery: 0,
  batteryMax: 0,
  score: 0,
  levelStartScore: 0,
  moves: 0,
  elapsed: 0,
  best: loadBest(),
  particles: makeParticles(),
  turning: null,
  pulse: 0,
  litBefore: new Set(),
  pausedFrom: 'playing',
};

const seed = readSeed();
const shot = readShot();
const ui = buildUI(document.getElementById('app'), { onMute: toggleMute });
const canvas = ui.canvas;
const ctx = canvas.getContext('2d');
let view = { x: 0, y: 0, cell: 40 };

function resize() {
  const stage = canvas.parentElement;
  const rect = stage.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const size = state.level ? state.level.grid.size : 6;
  const cell = Math.floor(Math.min(canvas.width, canvas.height) * 0.94 / size);
  view = {
    x: Math.floor((canvas.width - cell * size) / 2),
    y: Math.floor((canvas.height - cell * size) / 2),
    cell,
  };
}

window.addEventListener('resize', resize);

function litHouses() {
  return new Set(state.level.grid.houses.filter((h) => state.level.grid.cells[h].powered));
}

function refreshHUD() {
  ui.setLevel(`Level ${state.levelIndex + 1}/${LEVEL_COUNT}`);
  ui.setScore(`Skor ${state.score}`);
  const frac = state.batteryMax > 0 ? state.battery / state.batteryMax : 0;
  ui.setBattery(frac, frac < 0.25);
}

function startLevel(index) {
  state.levelIndex = index;
  state.level = buildLevel(index, seed);
  state.battery = state.level.battery;
  state.batteryMax = state.level.battery;
  state.levelStartScore = state.score;
  state.moves = 0;
  state.elapsed = 0;
  state.particles = makeParticles();
  state.turning = null;
  state.litBefore = litHouses();
  computePower(state.level.grid);
  state.screen = 'playing';
  ui.hideCard();
  resize();
  refreshHUD();
}

function startRun() {
  state.score = 0;
  startLevel(0);
}

function levelClearBonus() {
  const timeBonus = Math.max(0, Math.round((state.level.parSeconds - state.elapsed) * SCORE_TIME_PER_SECOND));
  return SCORE_LEVEL + state.battery * SCORE_BATTERY + timeBonus;
}

function showTitle() {
  state.screen = 'title';
  if (!state.level) startLevel(0);
  state.level.grid.cells.forEach((c) => { c.powered = false; });
  computePower(state.level.grid);
  ui.showCard(
    `<h1>Relay: Kota Padam</h1>
     <p class="tagline">Kota padam. Satu gardu masih hidup — dan kamu yang jaga jalurnya.</p>
     <p>Putar ubin kabel sampai daya dari gardu mengalir ke <b>semua rumah</b>. Setiap putaran menghabiskan <b>1 baterai</b>. Kalau baterai habis sebelum semua rumah menyala, kota tetap gelap.</p>
     <p class="meta">8 level • Skor terbaik: <b>${state.best}</b></p>`,
    [{ label: 'Mulai main', onClick: () => { sfx.select(); unlockAudio(); startRun(); } }],
  );
  refreshHUD();
}

function showLevelClear(bonus) {
  state.screen = 'levelClear';
  const last = state.levelIndex >= LEVEL_COUNT - 1;
  sfx.levelClear();
  // Sparks over every lit house.
  for (const h of state.level.grid.houses) {
    const { x, y } = cellXY(state.level.grid, h);
    spawnBurst(state.particles, view.x + (x + 0.5) * view.cell, view.y + (y + 0.5) * view.cell, PALETTE.houseHot, 14, 140);
  }
  ui.showCard(
    `<h1>Level ${state.levelIndex + 1} menyala!</h1>
     <p>Semua rumah sudah terang. Bonus level: <b>+${bonus}</b> (sisa baterai ${state.battery} • ${state.moves} putaran • ${Math.round(state.elapsed)} dtk).</p>
     <p class="meta">Skor: <b>${state.score}</b></p>`,
    [{ label: last ? 'Lihat hasil akhir' : 'Level berikutnya', onClick: () => { sfx.select(); advance(); } }],
  );
}

function showGameOver() {
  state.screen = 'gameOver';
  sfx.gameOver();
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }
  const lit = litHouses().size;
  const total = state.level.grid.houses.length;
  ui.showCard(
    `<h1>Baterai habis.</h1>
     <p>${lit} dari ${total} rumah sempat menyala di level ${state.levelIndex + 1}. Kota kembali gelap — tapi gardunya masih menunggu.</p>
     <p class="meta">Skor: <b>${state.score}</b> • Terbaik: <b>${state.best}</b></p>`,
    [
      { label: 'Coba level ini lagi', onClick: () => { sfx.select(); state.score = state.levelStartScore; startLevel(state.levelIndex); } },
      { label: 'Kembali ke judul', onClick: () => { sfx.select(); showTitle(); } },
    ],
  );
}

function showVictory() {
  state.screen = 'victory';
  sfx.victory();
  if (state.score > state.best) {
    state.best = state.score;
    saveBest(state.best);
  }
  ui.showCard(
    `<h1>Kota kembali terang!</h1>
     <p>Kamu menyalakan semua ${LEVEL_COUNT} level. Tidak ada lagi rumah yang gelap — gardu, kabel, dan kamu yang memutarnya, semuanya bekerja.</p>
     <p class="meta">Skor akhir: <b>${state.score}</b> • Terbaik: <b>${state.best}</b></p>`,
    [{ label: 'Main lagi', onClick: () => { sfx.select(); startRun(); } }],
  );
}

function advance() {
  if (state.levelIndex >= LEVEL_COUNT - 1) {
    showVictory();
  } else {
    startLevel(state.levelIndex + 1);
  }
}

function toggleMute() {
  setMuted(!isMuted());
  ui.setMuted(isMuted());
}

function confirm() {
  unlockAudio();
  if (state.screen === 'title') {
    sfx.select();
    startRun();
  } else if (state.screen === 'levelClear') {
    sfx.select();
    advance();
  } else if (state.screen === 'gameOver') {
    sfx.select();
    state.score = state.levelStartScore;
    startLevel(state.levelIndex);
  } else if (state.screen === 'victory') {
    sfx.select();
    startRun();
  }
}

function restart() {
  unlockAudio();
  if (state.screen === 'playing' || state.screen === 'paused') {
    state.score = state.levelStartScore;
    startLevel(state.levelIndex);
  }
}

function pause() {
  if (state.screen === 'playing') {
    state.pausedFrom = 'playing';
    state.screen = 'paused';
    ui.showCard(
      `<h1>Jeda</h1><p>Kota menunggu. Baterai tidak berkurang saat jeda.</p>`,
      [{ label: 'Lanjut main', onClick: () => { state.screen = 'playing'; ui.hideCard(); } }],
    );
  } else if (state.screen === 'paused') {
    state.screen = 'playing';
    ui.hideCard();
  }
}

// After a turn finishes, work out what changed: new lit houses (chime and
// sparks), a finished level, or an empty battery.
function afterTurn() {
  const grid = state.level.grid;
  computePower(grid);
  const now = litHouses();
  for (const h of now) {
    if (!state.litBefore.has(h)) {
      sfx.houseLit();
      const { x, y } = cellXY(grid, h);
      spawnBurst(state.particles, view.x + (x + 0.5) * view.cell, view.y + (y + 0.5) * view.cell, PALETTE.houseHot, 12, 120);
    }
  }
  state.litBefore = now;
  refreshHUD();
  if (allHousesPowered(grid)) {
    const bonus = levelClearBonus();
    state.score += bonus;
    refreshHUD();
    showLevelClear(bonus);
    return;
  }
  if (state.battery <= 0) {
    showGameOver();
  }
}

function turnAt(px, py) {
  if (state.screen !== 'playing' || state.turning) return;
  const grid = state.level.grid;
  const gx = Math.floor((px - view.x) / view.cell);
  const gy = Math.floor((py - view.y) / view.cell);
  if (gx < 0 || gy < 0 || gx >= grid.size || gy >= grid.size) return;
  const index = cellIndex(grid, gx, gy);
  const tile = grid.cells[index];
  if (!isTurnable(tile)) return;
  if (state.battery < BATTERY_PER_TURN) return;
  state.battery -= BATTERY_PER_TURN;
  state.moves += 1;
  sfx.turn();
  state.turning = { index, progress: 0 };
  refreshHUD();
}

makeInput(canvas, {
  onPointer(px, py) {
    unlockAudio();
    if (state.screen === 'playing') turnAt(px, py);
  },
  onConfirm: confirm,
  onRestart: restart,
  onMute: toggleMute,
  onPause: pause,
});

// The frame loop: advance the turn animation and the particles, then draw.
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  state.pulse = (Math.sin(now / 350) + 1) / 2;
  if (state.screen === 'playing') state.elapsed += dt;
  if (state.turning) {
    state.turning.progress += dt / TURN_SECONDS;
    if (state.turning.progress >= 1) {
      const index = state.turning.index;
      turnTile(state.level.grid.cells[index]);
      state.turning = null;
      afterTurn();
    }
  }
  stepParticles(state.particles, dt);
  if (state.level) {
    drawBoard(ctx, view, {
      grid: state.level.grid,
      battery: state.battery,
      particles: state.particles,
      turning: state.turning,
      pulse: state.pulse,
    });
  }
  requestAnimationFrame(frame);
}

// Screenshot scenes: deterministic setups the maker captures with a headless
// browser (?shot=title|play|clear|over|win&seed=N). The scene sets
// window.__shotReady once it is drawn, so the capture knows when to shoot.
function setupShot() {
  if (!shot) return;
  if (shot === 'title') {
    startLevel(0);
    showTitle();
  } else if (shot === 'play') {
    startLevel(1);
    // Solve the level most of the way, then knock wires out of place one at
    // a time until at least one house stays lit and at least one stays dark:
    // a real mid-game board, power flowing and a goal still open.
    const grid = state.level.grid;
    const solved = state.level.solved;
    for (let i = 0; i < grid.cells.length; i += 1) {
      if (solved[i] >= 0) grid.cells[i].orientation = solved[i];
    }
    computePower(grid);
    const routeTiles = [];
    for (let i = 0; i < grid.cells.length; i += 1) {
      if (solved[i] >= 0 && isTurnable(grid.cells[i])) routeTiles.push(i);
    }
    let knocked = 0;
    for (const i of routeTiles) {
      if (knocked >= 4) break;
      turnTile(grid.cells[i]);
      computePower(grid);
      const lit = litHouses().size;
      if (lit === 0) {
        // That wire fed every house; put it back and try the next one.
        turnTile(grid.cells[i]);
        turnTile(grid.cells[i]);
        turnTile(grid.cells[i]);
        computePower(grid);
        continue;
      }
      knocked += 1;
      if (lit < grid.houses.length) break;
    }
    computePower(grid);
    state.litBefore = litHouses();
    state.battery = Math.round(state.batteryMax * 0.7);
    state.score = 240;
    state.moves = 9;
    state.elapsed = 31;
    refreshHUD();
  } else if (shot === 'clear') {
    startLevel(0);
    // Solve the level for real, so every house is lit behind the card.
    const grid = state.level.grid;
    const solved = state.level.solved;
    for (let i = 0; i < grid.cells.length; i += 1) {
      if (solved[i] >= 0) grid.cells[i].orientation = solved[i];
    }
    computePower(grid);
    state.battery = 14;
    state.score = 310;
    state.moves = 11;
    state.elapsed = 38;
    refreshHUD();
    const bonus = levelClearBonus();
    state.score += bonus;
    showLevelClear(bonus);
  } else if (shot === 'over') {
    startLevel(2);
    state.battery = 0;
    state.score = 180;
    refreshHUD();
    showGameOver();
  } else if (shot === 'win') {
    startLevel(LEVEL_COUNT - 1);
    state.score = 2840;
    refreshHUD();
    showVictory();
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      window.__shotReady = true;
    });
  });
}

resize();
showTitle();
setupShot();
requestAnimationFrame(frame);
