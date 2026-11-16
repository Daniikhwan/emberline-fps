// EMBERLINE — deterministic screenshot staging for ?shot=start|play|site|end.
// Every shot starts from startMatch(), then teleports agents and fires scripted
// events so the frame reads as a real firefight. After staging the scene the
// sim is frozen: two renders, then window.__shotReady is set for the capture.
import { mulberry32 } from './utils.js';
import { WEAPONS, createWeaponState, weaponFire } from './weapons.js';

const STEP = 1 / 60;

function settle(game, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.playerStep(STEP);
    game.stepSim(STEP);
  }
  game.syncCamera();
  game.updateHud();
}

function placeBot(game, team, idx, x, z, yaw, weaponKey) {
  const bots = game.bots.bots.filter((b) => b.team === team);
  const bot = bots[idx % bots.length];
  bot.body.pos.set(x, 0, z);
  bot.body.vel.set(0, 0, 0);
  bot.body.yaw = yaw;
  bot.body.pitch = 0;
  if (weaponKey) bot.weapon = createWeaponState(WEAPONS[weaponKey]);
  bot.alive = true;
  bot.hp = 100;
  bot.fallT = 0;
  bot.parts.group.rotation.set(0, yaw, 0);
  bot.parts.group.position.set(x, 0, z);
  bot.parts.group.visible = true;
  return bot;
}

function setPlayer(game, x, z, yaw, pitch = 0) {
  const p = game.player;
  p.body.pos.set(x, 0, z);
  p.body.vel.set(0, 0, 0);
  p.body.yaw = yaw;
  p.body.pitch = pitch;
  p.alive = true;
  p.hp = 100;
}

export function runShot(game, name, seed, onReady) {
  const rng = mulberry32(seed * 7919 + 13);
  const { S } = game;
  let frames = 0;

  function finish() {
    game.syncCamera();
    game.updateHud();
    game.renderer.render(game.scene, game.camera);
    frames += 1;
    // SwiftShader's first frames are slow to composite; render several before
    // declaring the frame ready so the capture is never a black warm-up frame.
    if (frames >= 6) {
      window.__shotReady = true;
      onReady();
      return;
    }
    requestAnimationFrame(finish);
  }

  if (name === 'start') {
    game.startMatch();
    // spawn yard, looking north up the mid lane with teammates ahead
    setPlayer(game, 0, 21, 0.15);
    placeBot(game, 'jackals', 0, -3.5, 16, 0, 'rifle');
    placeBot(game, 'jackals', 1, 3.5, 17, -0.3, 'smg');
    placeBot(game, 'sentinels', 0, -1, -2, Math.PI, 'rifle');
    settle(game, 0.8);
  } else if (name === 'play') {
    game.startMatch();
    S.phase = 'live';
    S.phaseTime = 0;
    S.roundTimeLeft = 100;
    game.hud.showBuy(false);
    game.equipSlot('primary');
    // give the player a rifle and a firefight down A-long: a clear lane, the
    // Sentinel framed dead-centre so the tracer crosses the frame
    game.player.primary = createWeaponState(WEAPONS.rifle);
    game.equipSlot('primary');
    setPlayer(game, 24, 10, -0.12);
    const enemy = placeBot(game, 'sentinels', 0, 26, -6, Math.PI, 'rifle');
    placeBot(game, 'sentinels', 1, 22, -3, Math.PI + 0.3, 'smg');
    placeBot(game, 'jackals', 0, 20, 5, 0.2, 'rifle');
    placeBot(game, 'jackals', 1, 28, 13, -0.1, 'smg');
    settle(game, 0.5);
    // fire one burst at the Sentinel so the tracer, muzzle flash and sparks
    // are caught mid-flight; the sim freezes right after, keeping them in frame
    game.player.body.yaw = Math.atan2(-(enemy.body.pos.x - game.player.body.pos.x), -(enemy.body.pos.z - game.player.body.pos.z));
    const dx = enemy.body.pos.x - game.player.body.pos.x;
    const dy = (enemy.body.pos.y + 1.1) - (game.player.body.pos.y + game.player.body.eye);
    const dz = enemy.body.pos.z - game.player.body.pos.z;
    const len = Math.hypot(dx, dy, dz);
    if (weaponFire(game.player.weapon)) {
      game.combat.shoot(game.player, dx / len, dy / len, dz / len, 0.004);
    }
    game.audio.shot('rifle', 0);
    settle(game, 0.04);
  } else if (name === 'site') {
    game.startMatch();
    S.phase = 'live';
    S.phaseTime = 0;
    S.roundTimeLeft = 78;
    game.hud.showBuy(false);
    game.equipSlot('primary');
    // planting at Furnace Hall: player back from the furnace mouth so the
    // glow reads as a door rather than a flat billboard, smoke drifting
    // across the site, a Sentinel pushing in from the west, a Jackal at the
    // furnace
    game.player.primary = createWeaponState(WEAPONS.rifle);
    game.equipSlot('primary');
    setPlayer(game, 24, -11, -0.1, -0.04);
    placeBot(game, 'sentinels', 0, 23, -17.5, 2.8, 'rifle');
    placeBot(game, 'jackals', 0, 27, -16, 0.5, 'rifle');
    game.combat.smoke(19, -13);
    settle(game, 0.3);
    // plant state must be set AFTER the last settle: stepSim resets progress
    // whenever nobody is planting, and the render loop does not step the sim
    S.bomb.state = 'carried';
    S.bomb.carrier = game.player;
    game.player.planting = true;
    S.bomb.actor = game.player;
    S.bomb.progress = 0.55;
    S.bomb.x = 24;
    S.bomb.z = -11;
  } else if (name === 'end') {
    game.startMatch();
    S.score.jackals = 3;
    S.score.sentinels = 1;
    S.round = 4;
    S.phase = 'live';
    S.phaseTime = 0;
    S.roundTimeLeft = 41;
    game.hud.showBuy(false);
    game.player.primary = createWeaponState(WEAPONS.rifle);
    game.equipSlot('primary');
    setPlayer(game, 6, 12, 0.15);
    placeBot(game, 'jackals', 0, 0, 2, 0.3, 'rifle');
    const dead = placeBot(game, 'sentinels', 0, 1, -4, Math.PI, 'rifle');
    dead.hp = 0;
    dead.alive = false;
    dead.parts.group.visible = false; // eliminated: lying out of the frame
    S.feed.push({ text: 'You eliminated Bram', team: 'jackals', t: 0 });
    S.feed.push({ text: 'Rook eliminated Kett', team: 'jackals', t: 0 });
    S.feed.push({ text: 'Bomb detonated — site A', team: 'jackals', t: 0 });
    game.endRound('jackals', 'Bomb detonated at site A');
    settle(game, 0.2);
    // re-show the banner just before the capture: its 4.2 s real-time timer
    // would otherwise expire during the slow SwiftShader renders
    game.hud.banner('JACKALS WIN THE ROUND', 'Bomb detonated at site A', 10000);
  } else {
    game.startMatch();
    settle(game, 0.5);
  }

  void rng;
  requestAnimationFrame(finish);
}
