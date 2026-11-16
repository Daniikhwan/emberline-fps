// EMBERLINE — Kiln Yard: an original industrial foundry yard, 70 x 50 m.
// Flat ground, AABB colliders only. Jackals spawn south, Sentinels north;
// site A (Furnace Hall) is north-east, site B (Loading Dock) north-west.
// Procedural canvas textures, warm sun + shadows, furnace glow, sky dome.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { mulberry32 } from './utils.js';

function canvasTexture(size, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function noiseOn(ctx, size, rng, base, spots, alpha) {
  for (let i = 0; i < spots; i += 1) {
    const v = base + Math.floor(rng() * 36) - 18;
    ctx.fillStyle = `rgba(${v},${v - 4},${v - 10},${alpha})`;
    ctx.fillRect(rng() * size, rng() * size, 2 + rng() * 14, 2 + rng() * 14);
  }
}

export function createWorld(scene) {
  const rng = mulberry32(1337);
  const group = new THREE.Group();
  scene.add(group);

  // ---- procedural textures ----
  const groundTex = canvasTexture(512, (ctx, s) => {
    ctx.fillStyle = '#6e6258'; ctx.fillRect(0, 0, s, s);
    noiseOn(ctx, s, rng, 110, 900, 0.25);
    ctx.strokeStyle = 'rgba(40,34,28,0.5)'; ctx.lineWidth = 2;
    for (let i = 0; i < 12; i += 1) {
      ctx.beginPath();
      const x = rng() * s, y = rng() * s;
      ctx.moveTo(x, y); ctx.lineTo(x + (rng() - 0.5) * 160, y + (rng() - 0.5) * 160); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(60,52,44,0.8)'; ctx.lineWidth = 3;
    ctx.strokeRect(4, 4, s - 8, s - 8);
  }, 7, 5);
  const concreteTex = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#8d8378'; ctx.fillRect(0, 0, s, s);
    noiseOn(ctx, s, rng, 140, 500, 0.3);
    ctx.fillStyle = 'rgba(70,64,56,0.35)';
    for (let i = 0; i < 8; i += 1) ctx.fillRect(rng() * s, rng() * s, 30 + rng() * 60, 4);
  }, 2, 1);
  const metalTex = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#7a8288'; ctx.fillRect(0, 0, s, s);
    for (let x = 0; x < s; x += 16) {
      ctx.fillStyle = 'rgba(30,34,38,0.35)'; ctx.fillRect(x, 0, 5, s);
      ctx.fillStyle = 'rgba(200,210,215,0.18)'; ctx.fillRect(x + 8, 0, 3, s);
    }
    noiseOn(ctx, s, rng, 120, 260, 0.25);
  }, 2, 1);
  const hazardTex = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#e8a13a'; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = '#1c1a18';
    for (let i = -s; i < s * 2; i += 64) {
      ctx.beginPath();
      ctx.moveTo(i, 0); ctx.lineTo(i + 32, 0); ctx.lineTo(i + 32 + s, s); ctx.lineTo(i + s, s);
      ctx.closePath(); ctx.fill();
    }
  }, 4, 1);
  const woodTex = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#7a5a36'; ctx.fillRect(0, 0, s, s);
    for (let y = 0; y < s; y += 42) {
      ctx.fillStyle = `rgba(40,26,12,${0.25 + rng() * 0.2})`;
      ctx.fillRect(0, y, s, 4);
      ctx.strokeStyle = 'rgba(60,40,18,0.6)';
      for (let i = 0; i < 6; i += 1) {
        ctx.beginPath(); ctx.moveTo(0, y + 8 + rng() * 28);
        ctx.bezierCurveTo(s * 0.3, y + rng() * 40, s * 0.7, y + rng() * 40, s, y + 8 + rng() * 28);
        ctx.stroke();
      }
    }
  }, 1, 1);
  const rustTex = canvasTexture(256, (ctx, s) => {
    ctx.fillStyle = '#9a5a30'; ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 260; i += 1) {
      ctx.fillStyle = `rgba(${90 + rng() * 60},${30 + rng() * 30},10,${0.25 + rng() * 0.4})`;
      ctx.beginPath(); ctx.arc(rng() * s, rng() * s, 2 + rng() * 16, 0, 7); ctx.fill();
    }
    ctx.fillStyle = 'rgba(20,16,12,0.4)';
    for (let x = 0; x < s; x += 32) ctx.fillRect(x, 0, 3, s);
  }, 2, 1);

  const mats = {
    ground: new THREE.MeshStandardMaterial({ map: groundTex, roughness: 0.95, metalness: 0.02 }),
    concrete: new THREE.MeshStandardMaterial({ map: concreteTex, roughness: 0.92, metalness: 0.03 }),
    concreteDark: new THREE.MeshStandardMaterial({ color: PALETTE.concreteDark, roughness: 0.95 }),
    metal: new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.55, metalness: 0.55 }),
    metalDark: new THREE.MeshStandardMaterial({ color: PALETTE.metalDark, roughness: 0.6, metalness: 0.5 }),
    rust: new THREE.MeshStandardMaterial({ map: rustTex, roughness: 0.8, metalness: 0.35 }),
    hazard: new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.85 }),
    wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.9 }),
    teal: new THREE.MeshStandardMaterial({ color: PALETTE.containerTeal, roughness: 0.6, metalness: 0.4 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x2a2622, roughness: 0.9 }),
    glow: new THREE.MeshStandardMaterial({ color: 0x30160a, emissive: PALETTE.furnaceGlow, emissiveIntensity: 2.2 }),
    lamp: new THREE.MeshStandardMaterial({ color: 0x201a14, emissive: 0xffd9a0, emissiveIntensity: 1.6 }),
  };

  const colliders = [];
  const group2 = group;

  function box(w, h, d, x, y, z, mat, collide = true) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats[mat]);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group2.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3(
        new THREE.Vector3(x - w / 2, y - h / 2, z - d / 2),
        new THREE.Vector3(x + w / 2, y + h / 2, z + d / 2),
      ));
    }
    return mesh;
  }

  // ---- ground ----
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(140, 110), mats.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // ---- perimeter (70 x 50 playfield, walls 5 m) ----
  box(71.2, 5, 0.6, 0, 2.5, -25.3, 'concrete');
  box(71.2, 5, 0.6, 0, 2.5, 25.3, 'concrete');
  box(0.6, 5, 51.2, -35.3, 2.5, 0, 'concrete');
  box(0.6, 5, 51.2, 35.3, 2.5, 0, 'concrete');

  // ---- mid / A-long divider (x = 22) with two doors ----
  box(0.6, 4, 6, 22, 2, -5, 'concrete');
  box(0.6, 4, 7, 22, 2, 4.5, 'concrete');
  box(0.6, 4, 3, 22, 2, 12.5, 'concrete');
  // ---- mid / B-short divider (x = -22) ----
  box(0.6, 4, 6, -22, 2, -5, 'concrete');
  box(0.6, 4, 7, -22, 2, 4.5, 'concrete');
  box(0.6, 4, 3, -22, 2, 12.5, 'concrete');
  // ---- site fronts (z = -8) with one door each ----
  box(4, 4, 0.6, 10, 2, -8, 'concrete');
  box(7, 4, 0.6, 18.5, 2, -8, 'concrete');
  box(7, 4, 0.6, -18.5, 2, -8, 'concrete');
  box(4, 4, 0.6, -10, 2, -8, 'concrete');

  // ---- mid silo + crates ----
  box(4, 4.5, 4, 0, 2.25, 0, 'rust');
  box(1.2, 1.2, 1.2, -6, 0.6, 2, 'wood');
  box(1.2, 1.2, 1.2, 6, 0.6, -2, 'wood');
  box(1.2, 1.2, 1.2, 0, 0.6, 8, 'wood');
  box(1.2, 1.2, 1.2, -9, 0.6, -5, 'wood');
  box(1.2, 1.2, 1.2, 9, 0.6, -5, 'wood');
  box(2.4, 1.2, 1.2, -4, 0.6, -6, 'wood');
  box(2.4, 1.2, 1.2, 4, 0.6, 6, 'wood');

  // ---- A-long cover ----
  box(1.2, 1.2, 1.2, 27, 0.6, 4, 'wood');
  box(1.2, 1.2, 1.2, 30, 0.6, -2, 'wood');
  box(2.4, 1.2, 1.2, 26, 0.6, 10, 'wood');
  // ---- B-short cover ----
  box(1.2, 1.2, 1.2, -27, 0.6, 4, 'wood');
  box(1.2, 1.2, 1.2, -30, 0.6, -2, 'wood');
  box(2.4, 1.2, 1.2, -26, 0.6, 10, 'wood');

  // ---- site A: Furnace Hall ----
  box(7, 5, 4, 27, 2.5, -20, 'metalDark');
  box(1.6, 9, 1.6, 29.4, 4.5, -20.8, 'rust');
  const furnaceMouth = new THREE.Mesh(new THREE.BoxGeometry(3.4, 1.8, 0.3), mats.glow);
  furnaceMouth.position.set(27, 1.1, -17.9);
  group.add(furnaceMouth);
  box(1.2, 1.2, 1.2, 19, 0.6, -12, 'wood');
  box(1.2, 1.2, 1.2, 31, 0.6, -12, 'wood');
  box(2.4, 1.2, 1.2, 22, 0.6, -21, 'wood');
  box(0.9, 1.1, 0.9, 20, 0.55, -18, 'metalDark');
  box(0.9, 1.1, 0.9, 32, 0.55, -18, 'metalDark');

  // ---- site B: Loading Dock ----
  box(6, 2.6, 2.6, -27, 1.3, -18.7, 'teal');
  box(4, 2.6, 2.6, -20, 1.3, -19.7, 'rust');
  box(4.4, 2.6, 2.4, -27, 3.9, -18.7, 'rust');
  box(1.2, 1.2, 1.2, -19, 0.6, -12, 'wood');
  box(1.2, 1.2, 1.2, -31, 0.6, -12, 'wood');
  box(2.4, 1.2, 1.2, -24, 0.6, -21, 'wood');
  // canopy over the dock (high, blocks high shots only)
  box(10, 0.4, 6, -25, 4.6, -18, 'metalDark');

  // ---- spawn cover ----
  box(1.2, 1.2, 1.2, 8, 0.6, 18, 'wood');
  box(1.2, 1.2, 1.2, -8, 0.6, 18, 'wood');
  box(2.4, 1.2, 1.2, 0, 0.6, 21, 'wood');
  box(1.2, 1.2, 1.2, 8, 0.6, -18, 'wood');
  box(1.2, 1.2, 1.2, -8, 0.6, -18, 'wood');
  box(2.4, 1.2, 1.2, 0, 0.6, -21, 'wood');

  // ---- floodlight poles + lamps ----
  const polePositions = [[18, 12], [-18, 12], [10, 0], [-10, 0], [28, -14], [-28, -14]];
  for (const [px, pz] of polePositions) {
    box(0.25, 7, 0.25, px, 3.5, pz, 'metalDark');
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.3, 0.5), mats.lamp);
    lamp.position.set(px, 7.1, pz);
    group.add(lamp);
  }
  // ---- pipes along the east/west walls (high, bullets can clip them) ----
  box(0.5, 0.5, 48, 34.4, 3.6, 0, 'rust');
  box(0.5, 0.5, 48, -34.4, 3.6, 0, 'rust');

  // ---- site floor markings (hazard borders, no colliders) ----
  function stripe(x, z, w, d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mats.hazard);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    m.receiveShadow = true;
    group.add(m);
  }
  stripe(25, -9.2, 16, 0.5);
  stripe(25, -22.8, 16, 0.5);
  stripe(-25, -9.2, 16, 0.5);
  stripe(-25, -22.8, 16, 0.5);
  // site letters on the ground: big flat A / B from boxes (visual only)
  function letterA(cx, cz) {
    box(0.5, 0.06, 3, cx - 0.9, 0.03, cz, 'hazard', false);
    box(0.5, 0.06, 3, cx + 0.9, 0.03, cz, 'hazard', false);
    box(2.3, 0.06, 0.5, cx, 0.03, cz - 1.2, 'hazard', false);
    box(1.4, 0.06, 0.5, cx, 0.03, cz, 'hazard', false);
  }
  function letterB(cx, cz) {
    box(0.5, 0.06, 3, cx - 0.9, 0.03, cz, 'hazard', false);
    box(1.4, 0.06, 0.5, cx - 0.2, 0.03, cz - 1.25, 'hazard', false);
    box(1.4, 0.06, 0.5, cx - 0.2, 0.03, cz, 'hazard', false);
    box(1.4, 0.06, 0.5, cx - 0.2, 0.03, cz + 1.25, 'hazard', false);
    box(0.5, 0.06, 1.2, cx + 0.6, 0.03, cz - 0.65, 'hazard', false);
    box(0.5, 0.06, 1.2, cx + 0.6, 0.03, cz + 0.65, 'hazard', false);
  }
  letterA(25, -16);
  letterB(-25, -16);

  // ---- sky dome (gradient) + distant factory silhouettes ----
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 4; skyCanvas.height = 256;
  const sctx = skyCanvas.getContext('2d');
  const grad = sctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.55, PALETTE.skyMid);
  grad.addColorStop(1, PALETTE.skyLow);
  sctx.fillStyle = grad; sctx.fillRect(0, 0, 4, 256);
  const skyTex = new THREE.CanvasTexture(skyCanvas);
  skyTex.colorSpace = THREE.SRGBColorSpace;
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(180, 24, 16),
    new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, fog: false }),
  );
  scene.add(sky);
  const silhouetteMat = new THREE.MeshBasicMaterial({ color: 0x3a2f26, fog: false });
  const silhouettes = [
    [60, 14, -90, 26, 28, 8], [-70, 10, -80, 20, 20, 10], [95, 18, -40, 10, 36, 10],
    [-95, 12, 30, 30, 24, 8], [70, 8, 80, 24, 16, 8], [-60, 20, 90, 8, 40, 8],
  ];
  for (const [sx, sy, sz, sw, sh, sd] of silhouettes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(sw, sh, sd), silhouetteMat);
    m.position.set(sx, sy, sz);
    scene.add(m);
  }

  // ---- lights ----
  scene.add(new THREE.HemisphereLight(PALETTE.hemiSky, PALETTE.hemiGround, PALETTE.hemiIntensity));
  const sun = new THREE.DirectionalLight(PALETTE.sun, PALETTE.sunIntensity);
  sun.position.set(30, 38, 18);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -45;
  sun.shadow.camera.right = 45;
  sun.shadow.camera.top = 45;
  sun.shadow.camera.bottom = -45;
  sun.shadow.camera.far = 120;
  sun.shadow.bias = -0.0004;
  scene.add(sun, sun.target);
  const furnaceLightA = new THREE.PointLight(PALETTE.furnaceGlow, 26, 20, 1.8);
  furnaceLightA.position.set(27, 2.2, -16.5);
  scene.add(furnaceLightA);
  const furnaceLightB = new THREE.PointLight(PALETTE.furnaceGlow, 12, 12, 1.8);
  furnaceLightB.position.set(27, 1.4, -20.5);
  scene.add(furnaceLightB);
  scene.fog = new THREE.Fog(PALETTE.fog, 42, 165);

  // ---- waypoints: hand-placed graph bots route on ----
  // x right, z south. Jackals spawn south (+z), Sentinels north (-z).
  const nodes = [
    { x: 0, z: 21 }, // 0 jackal spawn
    { x: -8, z: 18 }, // 1
    { x: 8, z: 18 }, // 2
    { x: 0, z: 12 }, // 3 south mid
    { x: -8, z: 10 }, // 4
    { x: 8, z: 10 }, // 5
    { x: 0, z: 4 }, // 6 mid
    { x: -8, z: -2 }, // 7
    { x: 8, z: -2 }, // 8
    { x: 0, z: -6 }, // 9 north mid
    { x: 26, z: 12 }, // 10 A-long south
    { x: 27, z: 4 }, // 11 A-long
    { x: 27, z: -4 }, // 12 A-long north
    { x: 26, z: -10 }, // 13 A site entry
    { x: -26, z: 12 }, // 14 B-short south
    { x: -27, z: 4 }, // 15 B-short
    { x: -27, z: -4 }, // 16 B-short north
    { x: -26, z: -10 }, // 17 B site entry
    { x: 20, z: -12 }, // 18 A site west
    { x: 27, z: -14 }, // 19 A site plant
    { x: 31, z: -19 }, // 20 A site east
    { x: 22, z: -20 }, // 21 A site furnace
    { x: -20, z: -12 }, // 22 B site east
    { x: -27, z: -14 }, // 23 B site plant
    { x: -31, z: -19 }, // 24 B site west
    { x: -22, z: -20 }, // 25 B site dock
    { x: 0, z: -21 }, // 26 sentinel spawn
    { x: -8, z: -18 }, // 27
    { x: 8, z: -18 }, // 28
    { x: -12, z: -12 }, // 29 north hold west
    { x: 12, z: -12 }, // 30 north hold east
    { x: -13, z: 0 }, // 31 B-mid door
    { x: 13, z: 0 }, // 32 A-mid door
  ];
  const links = [
    [0, 1], [0, 2], [0, 3], [1, 4], [2, 5], [3, 4], [3, 5], [3, 6],
    [4, 7], [5, 8], [6, 7], [6, 8], [6, 9], [7, 9], [8, 9], [7, 31], [8, 32],
    [4, 14], [5, 10], [10, 11], [11, 12], [12, 13], [13, 19], [13, 18],
    [14, 15], [15, 16], [16, 17], [17, 23], [17, 22], [18, 19], [19, 20],
    [19, 21], [22, 23], [23, 24], [23, 25], [26, 27], [26, 28], [26, 9],
    [27, 29], [28, 30], [29, 7], [30, 8], [29, 22], [30, 18], [29, 31], [30, 32],
    [31, 15], [32, 11], [31, 7], [32, 8],
  ];
  for (const [a, b] of links) {
    nodes[a].links = nodes[a].links || [];
    nodes[b].links = nodes[b].links || [];
    nodes[a].links.push(b);
    nodes[b].links.push(a);
  }

  const sites = {
    A: { minX: 17, maxX: 33, minZ: -23, maxZ: -9, plant: { x: 26, z: -16 } },
    B: { minX: -33, maxX: -17, minZ: -23, maxZ: -9, plant: { x: -26, z: -16 } },
  };
  const spawns = {
    jackals: [[0, 21], [-4, 22], [4, 22], [-8, 19], [8, 19]],
    sentinels: [[0, -21], [-4, -22], [4, -22], [-8, -19], [8, -19]],
  };

  let flicker = 0;
  return {
    colliders,
    nodes,
    sites,
    spawns,
    update(dt, time) {
      flicker += dt;
      const f = 0.85 + Math.sin(flicker * 9.1) * 0.08 + Math.sin(flicker * 23.7) * 0.07;
      furnaceLightA.intensity = 26 * f;
      furnaceLightB.intensity = 12 * f;
      mats.glow.emissiveIntensity = 2.2 * f;
    },
  };
}
