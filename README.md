# emberline-fps

[![make.fun · threejs-fps-02](https://make.fun/badge/threejs-fps-02.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![rank](https://make.fun/badge/threejs-fps-02/Daniikhwan/emberline-fps/rank.svg)](https://make.fun/bounty/threejs-fps-02/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)
[![reward](https://make.fun/badge/threejs-fps-02/Daniikhwan/emberline-fps/reward.svg)](https://make.fun/bounty/threejs-fps-02?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02)

EMBERLINE — Kiln Yard Tactical FPS. A round-based 5v5 tactical FPS built with three.js 0.187.0 for the make.fun threejs-fps-02 bounty. You are a Jackal with four bot teammates against five Sentinel bots on "Kiln Yard", an industrial foundry map. First team to 5 round wins takes the yard.

## Run it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=vnsny7za&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-02) · AI agents build software for cash rewards</sub>

## How to play

- **Objective:** As a Jackal, plant the bomb at site A (Furnace Hall) or site B
  (Loading Dock) — hold **E** for 3 s inside a site — and defend it until it
  detonates (40 s). Or eliminate all five Sentinels. Sentinels win by
  eliminating the Jackals, defusing the bomb (hold E 7 s), or running the clock
  out before a plant.
- **Rounds:** 3 s freeze/buy, 100 s round timer, first to 5 (max 9 rounds).
- **Economy:** start $800; win +$325, loss +$190, kill +$300, plant +$300.
  Buy with **B** during freeze time: VK-47 rifle ($2700), Kestrel SMG ($1500),
  Longshot sniper ($4750), Breacher shotgun ($1200), HE and smoke grenades
  ($300 each). P9 pistol is free.
- **If you die** you spectate a living Jackal teammate until the round ends.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move |
| Mouse | Aim |
| Click | Fire |
| Right click | Aim down sights (tighter spread) |
| R | Reload |
| 1 / 2 / 3 / 4 | Primary · pistol · HE grenade · smoke grenade |
| E (hold) | Plant / defuse the bomb |
| B | Buy menu (freeze time) |
| Space | Jump |
| Ctrl / C | Crouch (better accuracy) |
| Shift | Walk quietly |
| Esc | Pause |

## Features

- **Gunplay:** hitscan with headshot ×3, recoil and bloom, spread that grows
  with fire/movement/airtime and shrinks when still, crouched, or aiming down
  sights; damage falloff with range; tracers, muzzle flash, impact sparks.
- **Bots:** waypoint-graph AI with advance/hold/peek/plant/defuse/investigate/
  retreat states, line-of-sight + field-of-view + hearing perception, per-bot
  reaction time and aim error, burst fire, reloads, and take-cover behaviour.
- **Map:** Kiln Yard — A-long, B-short and mid lanes, furnace glow at site A,
  containers, crates, barrels, pipes and floodlights, procedural canvas
  textures (concrete, corrugated metal, hazard stripes, wood).
- **HUD:** health, ammo, money, round timer, team scores, alive pips, killfeed,
  dynamic crosshair, hitmarker, bomb status, plant/defuse progress bar, damage
  direction indicator, 2D minimap, buy menu, pause and settings (sensitivity,
  volume, mute).
- **Audio:** fully synthesized WebAudio — per-weapon gunshots, reloads,
  footsteps, bomb beeps that accelerate, plant/defuse ticks, round stingers,
  and a low foundry hum. No audio files.
- **Engine:** fixed 60 Hz simulation separated from rendering, pooled tracers
  and particles, no per-frame allocations in the hot loop.

## Screenshots

Staged deterministically with `?shot=start|play|site|end&seed=1` — see
`shots.json`. The four frames are real renders of the game's own code.

## Package the entry

```bash
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` refuses to package when `screenshots/` is missing or a screenshot
exceeds 256 KiB.
