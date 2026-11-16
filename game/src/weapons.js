// EMBERLINE — weapons: definitions, view model, firing state, spread/recoil.
// One weapon per agent; the agent owns which definition it uses. Hitscan is
// resolved in combat.js; this module owns the gun's feel and its numbers.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { clamp } from './utils.js';

export const WEAPONS = {
  pistol: { name: 'P9', kind: 'pistol', price: 0, damage: 26, headMul: 3, mag: 12, reserve: 48, fireGap: 0.16, auto: false, reload: 1.4, spreadStill: 0.004, spreadMove: 0.02, recoil: 0.008, range: 40, pellets: 1, moveMul: 0.96 },
  rifle: { name: 'VK-47', kind: 'rifle', price: 2700, damage: 30, headMul: 3, mag: 30, reserve: 90, fireGap: 0.098, auto: true, reload: 2.1, spreadStill: 0.0022, spreadMove: 0.026, recoil: 0.011, range: 60, pellets: 1, moveMul: 0.94 },
  smg: { name: 'Kestrel', kind: 'smg', price: 1500, damage: 21, headMul: 3, mag: 28, reserve: 112, fireGap: 0.072, auto: true, reload: 1.8, spreadStill: 0.005, spreadMove: 0.03, recoil: 0.007, range: 32, pellets: 1, moveMul: 0.97 },
  sniper: { name: 'Longshot', kind: 'sniper', price: 4750, damage: 88, headMul: 3, mag: 5, reserve: 15, fireGap: 1.15, auto: false, reload: 3.0, spreadStill: 0.0006, spreadMove: 0.09, recoil: 0.05, range: 120, pellets: 1, moveMul: 0.9 },
  shotgun: { name: 'Breacher', kind: 'shotgun', price: 1200, damage: 13, headMul: 3, mag: 6, reserve: 24, fireGap: 0.85, auto: false, reload: 2.6, spreadStill: 0.02, spreadMove: 0.045, recoil: 0.03, range: 18, pellets: 8, moveMul: 0.95 },
};

export const GRENADES = {
  he: { name: 'HE Grenade', price: 300 },
  smoke: { name: 'Smoke Grenade', price: 300 },
};

// A soft round glow for the muzzle flash: a hard square reads as a paper kite,
// a radial gradient reads as fire.
function flashTexture() {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,240,200,1)');
  g.addColorStop(0.35, 'rgba(255,190,90,0.9)');
  g.addColorStop(1, 'rgba(255,120,20,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const FLASH_TEX = flashTexture();
export function createViewModel(camera, variant) {
  const dark = new THREE.MeshStandardMaterial({ color: 0x4a453d, roughness: 0.6, metalness: 0.4 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x8d9297, roughness: 0.4, metalness: 0.6 });
  const grip = new THREE.MeshStandardMaterial({ color: 0x3a2c1e, roughness: 0.85, metalness: 0.05 });
  const model = new THREE.Group();
  const add = (w, h, d, x, y, z, mat) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    model.add(m);
    return m;
  };
  if (variant === 'pistol') {
    add(0.05, 0.09, 0.22, 0, 0, -0.1, steel);
    add(0.045, 0.12, 0.06, 0, -0.09, 0.02, grip);
  } else if (variant === 'sniper') {
    add(0.08, 0.1, 0.5, 0, 0, -0.05, dark);
    add(0.04, 0.04, 0.55, 0, 0.03, -0.5, steel);
    add(0.06, 0.05, 0.16, 0, 0.08, -0.12, steel);
    add(0.07, 0.08, 0.2, 0, -0.02, 0.28, grip);
  } else if (variant === 'shotgun') {
    add(0.09, 0.1, 0.44, 0, 0, -0.05, dark);
    add(0.06, 0.06, 0.5, 0, -0.03, -0.35, steel);
    add(0.07, 0.08, 0.2, 0, -0.02, 0.28, grip);
  } else if (variant === 'smg') {
    add(0.08, 0.09, 0.34, 0, 0, -0.05, dark);
    add(0.04, 0.04, 0.3, 0, 0.02, -0.32, steel);
    add(0.05, 0.14, 0.05, 0, -0.1, -0.12, grip);
    add(0.07, 0.08, 0.18, 0, -0.02, 0.24, grip);
  } else {
    add(0.09, 0.1, 0.42, 0, 0, -0.05, dark);
    add(0.045, 0.045, 0.4, 0, 0.025, -0.42, steel);
    add(0.075, 0.08, 0.22, 0, -0.02, 0.3, grip);
    add(0.05, 0.06, 0.12, 0, -0.06, -0.05, grip);
  }
  model.position.set(0.24, -0.2, -0.42);
  camera.add(model);

  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.34, 0.34),
    new THREE.MeshBasicMaterial({ map: FLASH_TEX, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }),
  );
  flash.position.set(0.24, -0.17, -0.98);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(PALETTE.sun, 0, 6);
  flashLight.position.set(0.24, -0.14, -0.7);
  camera.add(flashLight);

  return {
    model, flash, flashLight,
    setVariant(v) {
      while (model.children.length) model.remove(model.children[0]);
      const next = createViewModel(camera, v);
      while (next.model.children.length) model.add(next.model.children[0]);
      camera.remove(next.flash, next.flashLight);
    },
  };
}

export function createWeaponState(def) {
  return {
    def,
    mag: def.mag,
    reserve: def.reserve,
    cooldown: 0,
    reloadLeft: 0,
    flash: 0,
    kick: 0,
    bloom: 0, // grows while firing, decays when still
  };
}

export function weaponStep(w, dt, view) {
  w.cooldown = Math.max(0, w.cooldown - dt);
  w.flash = Math.max(0, w.flash - dt);
  w.kick += (0 - w.kick) * Math.min(1, dt * 14);
  w.bloom = Math.max(0, w.bloom - dt * 0.09);
  if (view) {
    view.model.position.z = -0.42 + w.kick;
    view.model.rotation.x = w.kick * 2.2;
    view.flash.visible = w.flash > 0;
    view.flash.rotation.z = w.flash * 31;
    view.flashLight.intensity = w.flash > 0 ? 9 : 0;
    if (w.reloadLeft > 0) {
      view.model.rotation.x = -0.55 * Math.min(1, (w.def.reload - w.reloadLeft) * 2);
    }
  }
  if (w.reloadLeft > 0) {
    w.reloadLeft = Math.max(0, w.reloadLeft - dt);
    if (w.reloadLeft === 0) {
      const need = w.def.mag - w.mag;
      const take = Math.min(need, w.reserve);
      w.mag += take;
      w.reserve -= take;
    }
  }
}

export function weaponReady(w) {
  return w.mag > 0 && w.cooldown === 0 && w.reloadLeft === 0;
}

export function weaponFire(w) {
  if (!weaponReady(w)) return false;
  w.mag -= 1;
  w.cooldown = w.def.fireGap;
  w.flash = 0.1;
  w.kick = 0.05 + w.def.recoil;
  w.bloom = Math.min(0.09, w.bloom + 0.011);
  return true;
}

export function weaponReload(w) {
  if (w.reloadLeft > 0 || w.mag === w.def.mag || w.reserve === 0) return false;
  w.reloadLeft = w.def.reload;
  return true;
}

// Current spread in radians: still + crouched + ADS shrink it, moving, air and
// bloom grow it. Standing still and aiming is always the accurate choice.
export function weaponSpread(w, speed, crouched, ads, airborne) {
  const d = w.def;
  let s = d.spreadStill + clamp(speed / 5.6, 0, 1) * d.spreadMove + w.bloom;
  if (crouched) s *= 0.7;
  if (ads) s *= 0.45;
  if (airborne) s *= 1.8;
  return s;
}
