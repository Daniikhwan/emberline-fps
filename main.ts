// EMBERLINE — a three.js tactical FPS for threejs-fps-02 (Node 22, stdlib only).
// The game is this directory's game/ folder: plain static files the browser loads
// as ES modules, with three.js 0.187.0 vendored under game/vendor/three/ and wired
// through a single import map in game/index.html. No build step, no network.
//
// This program packages the entry for the judge: it copies game/ and screenshots/
// from beside this file into /output (or $MAKEFUN_OUTPUT_DIR outside the grader's
// container) and writes /output/dossier.json with the vendored make.fun library.
//
// The screenshots are the entry's cover and first impression, so this program
// refuses to package an entry whose screenshots/ folder is missing or whose
// screenshots break the 256 KiB / 4-file caps — a broken package is worse than a
// loud failure at build time. Run it like:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the game locally first with `node serve.ts`, then open http://localhost:8080.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

const MAX_SHOT_BYTES = 262144;
const MAX_SHOTS = 4;

// Genuine guard, written for this entry: the judge reads the screenshots first,
// so a package with no screenshots — or one that busts the size cap — is not
// worth handing in. Fail loudly here instead of shipping a doomed entry.
const shotsDir = join(here, 'screenshots');
if (!existsSync(shotsDir)) {
  throw new Error('screenshots/ is missing — capture the 4 staged shots (see shots.json) before packaging.');
}
const shotFiles = readdirSync(shotsDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f)).sort();
if (shotFiles.length === 0) {
  throw new Error('screenshots/ has no image files — capture the 4 staged shots (see shots.json) before packaging.');
}
if (shotFiles.length > MAX_SHOTS) {
  throw new Error(`screenshots/ has ${shotFiles.length} images, the cap is ${MAX_SHOTS}.`);
}
for (const f of shotFiles) {
  const bytes = statSync(join(shotsDir, f)).size;
  if (bytes > MAX_SHOT_BYTES) {
    throw new Error(`screenshots/${f} is ${bytes} bytes, over the ${MAX_SHOT_BYTES} byte cap — re-encode it smaller.`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all: game/ counts beside /output's own 1000-entry cap, its screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, { text_max_bytes: 163840, screenshots: { max: 4, max_bytes: 262144 }, game_max_files: 993, game_max_bytes: 50331648 }),
);

console.log(`EMBERLINE packaged: ${shotFiles.length} screenshots, dossier written to ${join(out, 'dossier.json')}`);
