# Relay: Kota Padam

[![make.fun](https://make.fun/badge/best-game-01.svg)](https://make.fun)
[![make.fun rank](https://make.fun/badge/best-game-01/myruldev/relay-kota-padam/rank.svg)](https://make.fun)
[![make.fun reward](https://make.fun/badge/best-game-01/myruldev/relay-kota-padam/reward.svg)](https://make.fun)

A complete, original puzzle game for the [make.fun Best Game bounty](https://make.fun/bounty/best-game-01). The city is blacked out. One power plant is still alive — and you are the technician keeping its lines connected.

## How to play

Rotate the wire tiles so power flows from the plant to **every house**. Each rotation costs **1 battery**. If the battery runs out before all the houses are lit, the city stays dark.

- **Click a tile** to rotate it 90° clockwise.
- **Enter** to start / continue, **R** to restart the level, **M** to mute, **P** to pause.
- **8 levels**, from a 5×5 grid with 2 houses to a 7×7 grid with 5 houses and rubble that can never carry a wire.
- **Score**: 100 per level, +10 per battery left, +5 per second under the par time. Your best score is kept in `localStorage`.

## Run it

No build step, no network. Serve the `game/` folder with any static server and open `index.html` in a desktop browser:

```sh
node serve.ts
# open http://localhost:8080
```

## How it is built

Plain ES modules on a `<canvas>`, no library, no assets. Sound is synthesized with WebAudio (no audio files). Levels are generated from their solution — a route is drawn from the plant to every house, the wires are set to match, the rest of the grid is decoy wire, and then every wire is spun. The battery is the rotations needed to undo that spin plus a slack, so every level is solvable by construction (proven by `test-levels.mjs`, which rebuilds all 8 levels and checks each one).

```
game/
  index.html        page, HUD and card styles
  src/
    main.js         state machine, game loop, screenshot scenes
    config.js       constants, level table, palette
    grid.js         tiles, ports, turning, power flow
    levels.js       level generation (routes, scramble, battery)
    render.js       canvas drawing, glow, particles
    input.js        mouse and keyboard
    ui.js           HUD bar and overlay cards
    audio.js        WebAudio sound effects
    random.js       seeded RNG
```

`main.ts` (Node 22, standard library only) copies `game/` and `screenshots/` to `/output` and writes `/output/dossier.json` with the vendored `vendor/makefun-game.ts`.

## Screenshots

1. Title — the blackout city and the rules.
2. Gameplay — power flowing, two houses lit, one still dark.
3. Level clear — every house lit, bonus breakdown.
4. Game over — battery empty, retry or back to title.

## License

MIT. See [LICENSE](LICENSE).
