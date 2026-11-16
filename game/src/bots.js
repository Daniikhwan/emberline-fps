// EMBERLINE — bot squad: 4 Jackal teammates and 5 Sentinel opponents.
// Waypoint routing (BFS over the map graph), sight + hearing perception,
// burst fire with per-bot reaction time and aim error, plant/defuse roles,
// hold angles, investigate, retreat. Think at 10 Hz; move and aim every step.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createMover } from './player.js';
import { createWeaponState, WEAPONS, weaponStep, weaponFire, weaponReload, weaponSpread } from './weapons.js';
import { segmentBlocked, yawTo, angleDiff, clamp } from './utils.js';

const JACKAL_NAMES = ['Rook', 'Vex', 'Hale', 'Moss'];
const SENTINEL_NAMES = ['Iris', 'Bram', 'Noor', 'Kett', 'Sable'];

function botMesh(team) {
  const accent = team === 'jackals' ? PALETTE.jackal : PALETTE.sentinel;
  const body = new THREE.MeshStandardMaterial({ color: 0x2e2a24, roughness: 0.85, metalness: 0.1 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c1a17, roughness: 0.9 });
  const accentMat = new THREE.MeshStandardMaterial({ color: accent, roughness: 0.5, metalness: 0.2, emissive: accent, emissiveIntensity: 0.35 });
  const group = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.62, 0.3), body);
  torso.position.y = 1.08;
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.12, 0.32), accentMat);
  chest.position.y = 1.28;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.32, 0.32), dark);
  head.position.y = 1.58;
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.09, 0.05), accentMat);
  visor.position.set(0, 1.6, -0.17);
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), dark);
  legL.position.set(-0.14, 0.36, 0);
  const legR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.72, 0.22), dark);
  legR.position.set(0.14, 0.36, 0);
  const armL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), body);
  armL.position.set(-0.34, 1.12, -0.05);
  const armR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.55, 0.16), body);
  armR.position.set(0.34, 1.12, -0.05);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.09, 0.62), dark);
  gun.position.set(0.1, 1.28, -0.4);
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.3),
    new THREE.MeshBasicMaterial({ color: PALETTE.sun, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.1, 1.3, -0.78);
  group.add(torso, chest, head, visor, legL, legR, armL, armR, gun, flash);
  group.traverse((m) => { if (m.isMesh) { m.castShadow = true; } });
  return { group, legL, legR, armL, armR, flash };
}

function findPath(nodes, from, to) {
  if (from === to) return [to];
  const prev = new Array(nodes.length).fill(-1);
  const queue = [from];
  prev[from] = from;
  while (queue.length) {
    const cur = queue.shift();
    for (const next of nodes[cur].links || []) {
      if (prev[next] === -1) {
        prev[next] = cur;
        if (next === to) {
          const path = [to];
          let n = to;
          while (n !== from) { n = prev[n]; path.unshift(n); }
          return path;
        }
        queue.push(next);
      }
    }
  }
  return [to];
}

function nearestNode(nodes, x, z) {
  let best = 0, bestD = Infinity;
  for (let i = 0; i < nodes.length; i += 1) {
    const d = (nodes[i].x - x) ** 2 + (nodes[i].z - z) ** 2;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export function createBots(scene, world, S, combat, audio) {
  const nodes = world.nodes;
  const bots = [];

  function makeBot(team, name, spawnIdx, weaponKey, skill) {
    const [sx, sz] = world.spawns[team][spawnIdx];
    const mover = createMover(world.colliders, sx, sz, team === 'jackals' ? 0 : Math.PI);
    const parts = botMesh(team);
    scene.add(parts.group);
    const bot = {
      id: bots.length + 1,
      name,
      team,
      isPlayer: false,
      alive: true,
      hp: 100,
      body: mover.body,
      mover,
      weapon: createWeaponState(WEAPONS[weaponKey]),
      mesh: parts.group,
      parts,
      state: 'advance',
      route: [],
      routeIdx: 0,
      targetNode: -1,
      holdNode: -1,
      site: null,
      thinkT: S.rng() * 0.1,
      reactT: 0,
      aimErr: skill.aimErr,
      reaction: skill.reaction,
      burstLeft: 0,
      burstPause: 0,
      holdT: 0,
      scanDir: 0,
      lastSeen: null,
      investigatePos: null,
      investigateT: 0,
      planting: false,
      defusing: false,
      walkPhase: 0,
      flashT: 0,
      fallT: 0,
      stuckT: 0,
      lastX: sx,
      lastZ: sz,
      lastDamageT: -99,
      stepSnd: 0,
    };
    bots.push(bot);
    return bot;
  }

  function spawnAll() {
    for (const b of bots) scene.remove(b.mesh);
    bots.length = 0;
    const jackalWeapons = ['rifle', 'rifle', 'smg', 'rifle'];
    const sentinelWeapons = ['rifle', 'smg', 'rifle', 'rifle', 'smg'];
    for (let i = 0; i < 4; i += 1) {
      makeBot('jackals', JACKAL_NAMES[i], i + 1, jackalWeapons[i], {
        aimErr: 0.02 + S.rng() * 0.03,
        reaction: 0.28 + S.rng() * 0.25,
      });
    }
    for (let i = 0; i < 5; i += 1) {
      makeBot('sentinels', SENTINEL_NAMES[i], i, sentinelWeapons[i], {
        aimErr: 0.018 + S.rng() * 0.032,
        reaction: 0.25 + S.rng() * 0.3,
      });
    }
    return bots;
  }

  function assignRound() {
    // Jackals: 2 to A, 2 to B (carrier goes to its site); Sentinels hold sites.
    const jackals = bots.filter((b) => b.team === 'jackals');
    const sentinels = bots.filter((b) => b.team === 'sentinels');
    jackals[0].site = 'A'; jackals[1].site = 'A'; jackals[2].site = 'B'; jackals[3].site = 'B';
    const carrier = S.bomb.carrier;
    if (carrier && !carrier.isPlayer) {
      // carrier bot pushes its own site
    }
    sentinels[0].holdNode = 19; sentinels[0].site = 'A';
    sentinels[1].holdNode = 20; sentinels[1].site = 'A';
    sentinels[2].holdNode = 23; sentinels[2].site = 'B';
    sentinels[3].holdNode = 24; sentinels[3].site = 'B';
    sentinels[4].holdNode = 9; sentinels[4].site = null; // mid
    for (const b of bots) {
      b.state = b.team === 'sentinels' ? 'hold' : 'advance';
      b.route = [];
      b.routeIdx = 0;
      b.planting = false;
      b.defusing = false;
      b.lastSeen = null;
      b.investigatePos = null;
    }
    // Jackal routes: spawn -> lane -> site entry -> plant spot
    for (const b of jackals) {
      const entry = b.site === 'A' ? 13 : 17;
      const plant = b.site === 'A' ? 19 : 23;
      const from = nearestNode(nodes, b.body.pos.x, b.body.pos.z);
      b.route = findPath(nodes, from, entry).concat([plant]);
      b.routeIdx = 0;
    }
  }

  function canSee(bot, enemy) {
    const b = bot.body;
    const dx = enemy.body.pos.x - b.pos.x;
    const dz = enemy.body.pos.z - b.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 46) return false;
    const eyeY = b.pos.y + b.eye;
    const tgtY = enemy.body.pos.y + enemy.body.height * 0.6;
    const fwdX = -Math.sin(b.yaw), fwdZ = -Math.cos(b.yaw);
    const dot = (dx * fwdX + dz * fwdZ) / (dist || 1);
    if (dist > 6 && dot < 0.25) return false; // outside ~75 deg cone (close range hears all)
    return !segmentBlocked(b.pos.x, eyeY, b.pos.z, enemy.body.pos.x, tgtY, enemy.body.pos.z, world.colliders, S.smokes);
  }

  function visibleEnemy(bot) {
    let best = null, bestD = Infinity;
    for (const e of S.agents) {
      if (e.team === bot.team || !e.alive) continue;
      const d = Math.hypot(e.body.pos.x - bot.body.pos.x, e.body.pos.z - bot.body.pos.z);
      if (d < bestD && canSee(bot, e)) { best = e; bestD = d; }
    }
    return best;
  }

  function think(bot, dt) {
    bot.thinkT -= dt;
    if (bot.thinkT > 0) return;
    bot.thinkT = 0.1;
    const enemy = visibleEnemy(bot);
    if (enemy) {
      if (!bot.lastSeen || bot.lastSeen.who !== enemy) bot.reactT = bot.reaction;
      bot.lastSeen = { who: enemy, x: enemy.body.pos.x, z: enemy.body.pos.z, t: S.time };
      bot.state = 'engage';
      bot.planting = false;
      bot.defusing = false;
    } else if (bot.state === 'engage') {
      bot.state = bot.team === 'sentinels' ? 'hold' : 'advance';
      bot.lastSeen = null;
    }
    // hearing: a recent shot within 25 m pulls a bot to investigate
    const shot = S.lastShot;
    if (shot && S.time - shot.t < 0.4 && shot.team !== bot.team) {
      const d = Math.hypot(shot.x - bot.body.pos.x, shot.z - bot.body.pos.z);
      if (d < 25 && !enemy && bot.state !== 'engage') {
        bot.investigatePos = { x: shot.x, z: shot.z };
        bot.investigateT = 2.5;
        bot.state = 'investigate';
      }
    }
    // low HP retreat
    if (bot.hp < 25 && bot.state !== 'engage' && bot.state !== 'retreat') {
      bot.state = 'retreat';
      bot.holdT = 3;
    }
    // bomb states
    const B = S.bomb;
    if (bot.team === 'sentinels' && B.state === 'planted') {
      const d = Math.hypot(B.x - bot.body.pos.x, B.z - bot.body.pos.z);
      if (!enemy && d < 14) {
        bot.state = 'defuse';
        bot.targetNode = nearestNode(nodes, B.x, B.z);
      } else if (!enemy && bot.state !== 'engage') {
        bot.state = 'advance';
        bot.route = findPath(nodes, nearestNode(nodes, bot.body.pos.x, bot.body.pos.z), nearestNode(nodes, B.x, B.z));
        bot.routeIdx = 0;
      }
    }
    if (bot.team === 'jackals' && B.carrier === bot && !enemy) {
      bot.state = 'advance';
      if (!bot.route.length || bot.route[bot.route.length - 1] !== (bot.site === 'A' ? 19 : 23)) {
        const plant = bot.site === 'A' ? 19 : 23;
        bot.route = findPath(nodes, nearestNode(nodes, bot.body.pos.x, bot.body.pos.z), plant);
        bot.routeIdx = 0;
      }
    }
    // dropped bomb pickup
    if (bot.team === 'jackals' && B.state === 'dropped') {
      const d = Math.hypot(B.x - bot.body.pos.x, B.z - bot.body.pos.z);
      if (d < 1.6) {
        B.state = 'carried';
        B.carrier = bot;
        S.feed.push({ text: `${bot.name} picked up the bomb`, team: 'jackals', t: S.time });
      } else if (!enemy && bot.state !== 'engage') {
        bot.route = findPath(nodes, nearestNode(nodes, bot.body.pos.x, bot.body.pos.z), nearestNode(nodes, B.x, B.z));
        bot.routeIdx = 0;
        bot.state = 'advance';
      }
    }
  }

  function aimAt(bot, tx, tz, ty, dt, err) {
    const b = bot.body;
    const dx = tx - b.pos.x, dz = tz - b.pos.z;
    const wantYaw = yawTo(b.pos.x, b.pos.z, tx, tz);
    const dyaw = angleDiff(b.yaw, wantYaw);
    const turn = clamp(dyaw, -3.6 * dt, 3.6 * dt);
    b.yaw += turn;
    const wantPitch = Math.atan2(ty - (b.pos.y + b.eye), Math.hypot(dx, dz));
    b.pitch += clamp(wantPitch - b.pitch, -2.4 * dt, 2.4 * dt);
    return Math.abs(dyaw) < 0.08 + err;
  }

  function botStep(bot, dt) {
    if (!bot.alive) return;
    think(bot, dt);
    weaponStep(bot.weapon, dt, null);
    const b = bot.body;
    let fwd = 0, strafe = 0, crouch = false;
    const enemy = bot.lastSeen && S.time - bot.lastSeen.t < 0.6 ? bot.lastSeen.who : null;
    // freeze time is safe: bots may move to their angles but never fire
    const target = enemy && enemy.alive && S.phase === 'live' ? enemy : null;

    if (target) {
      // engage: face the target, strafe, burst fire
      const aligned = aimAt(bot, target.body.pos.x, target.body.pos.z, target.body.pos.y + target.body.height * 0.6, dt, bot.aimErr);
      bot.reactT -= dt;
      if (bot.reactT <= 0 && aligned) {
        if (bot.burstLeft > 0) {
          if (bot.weapon.mag === 0) { weaponReload(bot.weapon); }
          else if (weaponFire(bot.weapon)) {
            bot.burstLeft -= 1;
            const spread = weaponSpread(bot.weapon, bot.mover.groundSpeed(), false, false, !b.onGround) + bot.aimErr;
            const dx = -Math.sin(b.yaw) + (S.rng() * 2 - 1) * spread;
            const dy = Math.tan(b.pitch) + (S.rng() * 2 - 1) * spread;
            const dz = -Math.cos(b.yaw) + (S.rng() * 2 - 1) * spread;
            const len = Math.hypot(dx, dy, dz) || 1;
            combat.shoot(bot, dx / len, dy / len, dz / len, 0);
            bot.flashT = 0.06;
            const dist = Math.hypot(target.body.pos.x - b.pos.x, target.body.pos.z - b.pos.z);
            audio.shot(bot.weapon.def.kind, dist);
            b.pitch += 0.004;
          }
        } else {
          bot.burstPause -= dt;
          if (bot.burstPause <= 0) {
            bot.burstLeft = 3 + Math.floor(S.rng() * 3);
            bot.burstPause = 0.4 + S.rng() * 0.5;
          }
        }
      }
      // strafe perpendicular, change direction sometimes
      bot.holdT -= dt;
      if (bot.holdT <= 0) { bot.holdT = 0.7 + S.rng() * 0.8; bot.scanDir = S.rng() < 0.5 ? -1 : 1; }
      strafe = bot.scanDir * 0.7;
      if (bot.hp < 40) crouch = true;
    } else if (bot.state === 'hold') {
      // camp the hold node, sweep the view
      const node = nodes[bot.holdNode];
      const d = Math.hypot(node.x - b.pos.x, node.z - b.pos.z);
      if (d > 1.2) {
        fwd = 1;
        b.yaw += angleDiff(b.yaw, yawTo(b.pos.x, b.pos.z, node.x, node.z)) * Math.min(1, dt * 4);
      } else {
        bot.scanDir += dt * 0.5;
        b.yaw += Math.sin(bot.scanDir) * dt * 0.9;
        crouch = S.rng() < 0.3;
      }
    } else if (bot.state === 'investigate' && bot.investigatePos) {
      const d = Math.hypot(bot.investigatePos.x - b.pos.x, bot.investigatePos.z - b.pos.z);
      if (d > 1.5) {
        fwd = 1;
        b.yaw += angleDiff(b.yaw, yawTo(b.pos.x, b.pos.z, bot.investigatePos.x, bot.investigatePos.z)) * Math.min(1, dt * 5);
      } else {
        bot.investigateT -= dt;
        b.yaw += dt * 1.2;
        if (bot.investigateT <= 0) { bot.state = bot.team === 'sentinels' ? 'hold' : 'advance'; bot.investigatePos = null; }
      }
    } else if (bot.state === 'retreat') {
      const spawn = world.spawns[bot.team][0];
      fwd = 1;
      b.yaw += angleDiff(b.yaw, yawTo(b.pos.x, b.pos.z, spawn[0], spawn[1])) * Math.min(1, dt * 5);
      bot.holdT -= dt;
      if (bot.holdT <= 0) bot.state = bot.team === 'sentinels' ? 'hold' : 'advance';
    } else if (bot.state === 'defuse') {
      const B = S.bomb;
      const d = Math.hypot(B.x - b.pos.x, B.z - b.pos.z);
      if (d > 2.2) {
        fwd = 1;
        b.yaw += angleDiff(b.yaw, yawTo(b.pos.x, b.pos.z, B.x, B.z)) * Math.min(1, dt * 5);
      } else {
        bot.defusing = true;
        B.actor = bot;
        crouch = true;
      }
    } else {
      // advance along the route
      if (bot.routeIdx < bot.route.length) {
        const node = nodes[bot.route[bot.routeIdx]];
        const d = Math.hypot(node.x - b.pos.x, node.z - b.pos.z);
        if (d < 1.4) {
          bot.routeIdx += 1;
        } else {
          fwd = 1;
          b.yaw += angleDiff(b.yaw, yawTo(b.pos.x, b.pos.z, node.x, node.z)) * Math.min(1, dt * 5);
        }
      } else {
        // arrived: carrier plants, others hold the spot
        if (S.bomb.carrier === bot) {
          bot.planting = true;
          S.bomb.actor = bot;
          crouch = true;
        } else {
          bot.holdT -= dt;
          b.yaw += Math.sin(S.time * 0.6 + bot.id) * dt * 0.5;
          if (bot.holdT <= -4) bot.holdT = 0;
        }
      }
    }

    // stuck detection: no progress while advancing -> skip a waypoint
    const moved = Math.hypot(b.pos.x - bot.lastX, b.pos.z - bot.lastZ);
    if (moved < 0.02) bot.stuckT += dt;
    else bot.stuckT = 0;
    bot.lastX = b.pos.x; bot.lastZ = b.pos.z;
    if (bot.stuckT > 2 && bot.routeIdx < bot.route.length) {
      bot.routeIdx += 1;
      bot.stuckT = 0;
    }

    bot.mover.step(dt, fwd, strafe, crouch, false);
    if (bot.weapon.mag === 0 && !target) weaponReload(bot.weapon);
    if (bot.weapon.reloadLeft === 0 && bot.weapon.mag < bot.weapon.def.mag * 0.25 && !target) weaponReload(bot.weapon);

    // walk cycle + mesh pose
    const speed = bot.mover.groundSpeed();
    bot.walkPhase += speed * dt * 2.4;
    const swing = Math.min(1, speed / 4) * 0.55;
    bot.parts.legL.rotation.x = Math.sin(bot.walkPhase) * swing;
    bot.parts.legR.rotation.x = -Math.sin(bot.walkPhase) * swing;
    bot.parts.armL.rotation.x = -Math.sin(bot.walkPhase) * swing * 0.7;
    bot.parts.armR.rotation.x = Math.sin(bot.walkPhase) * swing * 0.7;
    bot.parts.flash.material.opacity = bot.flashT > 0 ? 0.9 : 0;
    bot.flashT = Math.max(0, bot.flashT - dt);
    bot.parts.group.position.set(b.pos.x, b.pos.y, b.pos.z);
    bot.parts.group.rotation.y = b.yaw;
    bot.stepSnd -= dt;
    if (speed > 1 && bot.stepSnd <= 0) {
      bot.stepSnd = 0.42;
      const d = Math.hypot(b.pos.x - S.player.body.pos.x, b.pos.z - S.player.body.pos.z);
      if (d < 22) audio.step(false);
    }
  }

  function renderDead(bot, dt) {
    if (bot.fallT < 1) {
      bot.fallT = Math.min(1, bot.fallT + dt * 2.2);
      bot.parts.group.rotation.x = -Math.PI / 2 * bot.fallT * 0.9;
      bot.parts.group.position.y = bot.body.pos.y + 0.25 * bot.fallT;
    }
  }

  function step(dt) {
    for (const bot of bots) {
      if (bot.alive) botStep(bot, dt);
      else renderDead(bot, dt);
    }
  }

  function resetRound() {
    for (const bot of bots) {
      const idx = bots.indexOf(bot);
      const spawn = world.spawns[bot.team][idx % 5];
      bot.body.pos.set(spawn[0], 0, spawn[1]);
      bot.body.vel.set(0, 0, 0);
      bot.body.yaw = bot.team === 'jackals' ? 0 : Math.PI;
      bot.body.pitch = 0;
      bot.hp = 100;
      bot.alive = true;
      bot.fallT = 0;
      bot.weapon = createWeaponState(bot.team === 'jackals'
        ? WEAPONS[['rifle', 'rifle', 'smg', 'rifle'][idx % 4]]
        : WEAPONS[['rifle', 'smg', 'rifle', 'rifle', 'smg'][idx % 5]]);
      bot.parts.group.rotation.set(0, bot.body.yaw, 0);
      bot.parts.group.position.set(bot.body.pos.x, 0, bot.body.pos.z);
      bot.parts.group.visible = true;
      bot.lastDamageT = -99;
    }
    assignRound();
  }

  return { bots, spawnAll, step, assignRound, resetRound, nearestNode, findPath };
}
