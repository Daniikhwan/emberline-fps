// EMBERLINE — agent movement: one mover shared by the player and every bot.
// Acceleration, friction, gravity, jump and crouch, resolved as a box against
// the world's AABB colliders one axis at a time, so a wall never swallows an agent.
import * as THREE from 'three';
import { TUNING } from './palette.js';
import { clamp } from './utils.js';

const RADIUS = TUNING.agentRadius;
const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.12;

export function createMover(colliders, x, z, yaw) {
  const body = {
    pos: new THREE.Vector3(x, 0, z),
    vel: new THREE.Vector3(),
    yaw,
    pitch: 0,
    eye: TUNING.eyeStanding,
    onGround: true,
    crouching: false,
    height: STAND_HEIGHT,
  };
  const probe = new THREE.Box3();

  function overlaps(x, y, z, height, lift) {
    probe.min.set(x - RADIUS, y + lift, z - RADIUS);
    probe.max.set(x + RADIUS, y + height - lift, z + RADIUS);
    for (let i = 0; i < colliders.length; i += 1) {
      if (probe.intersectsBox(colliders[i])) return colliders[i];
    }
    return null;
  }

  function setCrouch(want) {
    if (want && !body.crouching) {
      body.crouching = true;
      body.height = CROUCH_HEIGHT;
    } else if (!want && body.crouching && !overlaps(body.pos.x, body.pos.y, body.pos.z, STAND_HEIGHT, 0.02)) {
      body.crouching = false;
      body.height = STAND_HEIGHT;
    }
  }

  function step(dt, forward, strafe, wantCrouch, wantJump) {
    setCrouch(wantCrouch);
    const eyeTarget = body.crouching ? TUNING.eyeCrouched : TUNING.eyeStanding;
    body.eye += (eyeTarget - body.eye) * Math.min(1, dt * 12);

    const sin = Math.sin(body.yaw);
    const cos = Math.cos(body.yaw);
    let wx = 0, wz = 0;
    if (forward || strafe) {
      wx = -sin * forward + cos * strafe;
      wz = -cos * forward - sin * strafe;
      const len = Math.hypot(wx, wz) || 1;
      wx /= len; wz /= len;
    }
    const speed = body.crouching ? TUNING.crouchSpeed : TUNING.walkSpeed;
    const accel = body.onGround ? TUNING.accel : TUNING.accel * 0.22;
    const blend = Math.min(1, accel * dt / speed);
    body.vel.x += (wx * speed - body.vel.x) * blend;
    body.vel.z += (wz * speed - body.vel.z) * blend;
    if (body.onGround && !forward && !strafe) {
      const damp = Math.max(0, 1 - TUNING.friction * dt);
      body.vel.x *= damp;
      body.vel.z *= damp;
    }
    if (wantJump && body.onGround) {
      body.vel.y = TUNING.jumpSpeed;
      body.onGround = false;
    }
    body.vel.y -= TUNING.gravity * dt;

    const nextX = body.pos.x + body.vel.x * dt;
    if (!overlaps(nextX, body.pos.y, body.pos.z, body.height, 0.04)) body.pos.x = nextX;
    else body.vel.x = 0;
    const nextZ = body.pos.z + body.vel.z * dt;
    if (!overlaps(body.pos.x, body.pos.y, nextZ, body.height, 0.04)) body.pos.z = nextZ;
    else body.vel.z = 0;

    body.pos.y += body.vel.y * dt;
    body.onGround = false;
    const hit = overlaps(body.pos.x, body.pos.y, body.pos.z, body.height, 0);
    if (hit && body.vel.y <= 0) {
      body.pos.y = hit.max.y;
      body.vel.y = 0;
      body.onGround = true;
    } else if (hit) {
      body.pos.y = hit.min.y - body.height;
      body.vel.y = 0;
    }
    if (body.pos.y < 0) {
      body.pos.y = 0;
      body.vel.y = 0;
      body.onGround = true;
    }
    body.vel.y = Math.max(-30, body.vel.y);
  }

  return {
    body,
    step,
    groundSpeed() { return Math.hypot(body.vel.x, body.vel.z); },
    look(dx, dy, sensitivity) {
      body.yaw -= dx * sensitivity;
      body.pitch = clamp(body.pitch - dy * sensitivity, -1.45, 1.45);
    },
    recoil(pitchKick, yawKick) {
      body.pitch = Math.min(1.45, body.pitch + pitchKick);
      body.yaw += yawKick;
    },
  };
}

// The human player: input-driven mover plus health and weapon ownership.
export function createPlayer(colliders, x, z, yaw) {
  const mover = createMover(colliders, x, z, yaw);
  return {
    ...mover,
    isPlayer: true,
    hp: TUNING.playerHp,
    alive: true,
  };
}
