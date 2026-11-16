// EMBERLINE — the DOM HUD. It never touches the simulation; main.js pushes
// numbers in and reads callbacks out. All updates are cheap DOM writes, cached
// so nothing is set twice.
import { PALETTE } from './palette.js';

const BUY_ITEMS = [
  { id: 'rifle', key: '1', name: 'VK-47 Rifle', price: 2700, desc: 'Auto · 30 rd · high damage' },
  { id: 'smg', key: '2', name: 'Kestrel SMG', price: 1500, desc: 'Auto · 28 rd · fast, close range' },
  { id: 'sniper', key: '3', name: 'Longshot', price: 4750, desc: 'Bolt · 5 rd · one-shot head' },
  { id: 'shotgun', key: '4', name: 'Breacher', price: 1200, desc: 'Pump · 6 shells · 8 pellets' },
  { id: 'he', key: '5', name: 'HE Grenade', price: 300, desc: 'Blast · 7 m radius' },
  { id: 'smoke', key: '6', name: 'Smoke Grenade', price: 300, desc: 'Blocks sight · 15 s' },
];

export function createHud(S, world) {
  const $ = (id) => document.getElementById(id);
  const el = {
    overlay: $('overlay'), title: $('overlay-title'), copy: $('overlay-copy'),
    play: $('play'), restart: $('restart'),
    crosshair: $('crosshair'), hitmarker: $('hitmarker'),
    healthFill: $('health-fill'), healthNum: $('health-num'),
    ammoMag: $('ammo-mag'), ammoReserve: $('ammo-reserve'), ammoName: $('ammo-name'),
    money: $('money'), timer: $('timer'), scoreJ: $('score-j'), scoreS: $('score-s'),
    roundLabel: $('round-label'), feed: $('feed'), minimap: $('minimap'),
    bombStatus: $('bomb-status'), banner: $('banner'), bannerTitle: $('banner-title'),
    bannerSub: $('banner-sub'), buy: $('buy'), buyItems: $('buy-items'), buyMoney: $('buy-money'),
    vignette: $('vignette'), dirHit: $('dir-hit'), plantBar: $('plant-bar'),
    plantFill: $('plant-fill'), plantLabel: $('plant-label'),
    spec: $('spectate'), pipsJ: $('pips-j'), pipsS: $('pips-s'),
    settings: $('settings'), sens: $('sens'), vol: $('vol'), mute: $('mute'),
  };
  const mm = el.minimap.getContext('2d');
  let last = {};
  let hitTimer = 0;
  let bannerTimer = 0;
  let buyHandler = null;
  let playHandler = null;
  let restartHandler = null;

  // build the buy menu once
  for (const item of BUY_ITEMS) {
    const row = document.createElement('button');
    row.className = 'buy-row';
    row.type = 'button';
    row.dataset.id = item.id;
    row.innerHTML = `<span class="buy-key">${item.key}</span><span class="buy-name">${item.name}</span><span class="buy-desc">${item.desc}</span><span class="buy-price">$${item.price}</span>`;
    row.addEventListener('click', () => { if (buyHandler) buyHandler(item.id); });
    el.buyItems.appendChild(row);
  }
  el.play.addEventListener('click', () => { if (playHandler) playHandler(); });
  el.restart.addEventListener('click', () => { if (restartHandler) restartHandler(); });
  el.sens.addEventListener('input', () => { S.sensitivity = Number(el.sens.value); });
  el.vol.addEventListener('input', () => { S.volume = Number(el.vol.value); });
  el.mute.addEventListener('change', () => { S.muted = el.mute.checked; });

  function setText(node, key, value) {
    if (last[key] !== value) { last[key] = value; node.textContent = value; }
  }

  function drawMinimap() {
    const W = 150, H = 110;
    mm.clearRect(0, 0, W, H);
    mm.fillStyle = 'rgba(20,18,16,0.85)';
    mm.fillRect(0, 0, W, H);
    const sx = W / 72, sz = H / 52;
    const px = (x) => (x + 36) * sx;
    const pz = (z) => (z + 26) * sz;
    // sites
    mm.fillStyle = 'rgba(240,168,48,0.35)';
    mm.fillRect(px(17), pz(-23), (33 - 17) * sx, 14 * sz);
    mm.fillRect(px(-33), pz(-23), 16 * sx, 14 * sz);
    mm.fillStyle = '#f0a830';
    mm.font = 'bold 11px sans-serif';
    mm.fillText('A', px(24), pz(-15));
    mm.fillText('B', px(-26), pz(-15));
    // walls
    mm.fillStyle = 'rgba(233,230,223,0.55)';
    for (const c of world.colliders) {
      if (c.max.y < 1) continue;
      mm.fillRect(px(c.min.x), pz(c.min.z), (c.max.x - c.min.x) * sx, (c.max.z - c.min.z) * sz);
    }
    // bomb
    const B = S.bomb;
    if (B.state === 'planted') {
      const blink = Math.floor(S.time * 3) % 2 === 0;
      mm.fillStyle = blink ? '#ff3a1e' : '#ffd9a0';
      mm.beginPath(); mm.arc(px(B.x), pz(B.z), 4, 0, 7); mm.fill();
    } else if (B.state === 'dropped' && B.carrier === null) {
      mm.fillStyle = '#ff3a1e';
      mm.beginPath(); mm.arc(px(B.x), pz(B.z), 3, 0, 7); mm.fill();
    }
    // agents
    for (const a of S.agents) {
      if (!a.alive) continue;
      mm.fillStyle = a.team === 'jackals' ? '#f0a830' : '#2fb3a8';
      mm.beginPath(); mm.arc(px(a.body.pos.x), pz(a.body.pos.z), a.isPlayer ? 4 : 3, 0, 7); mm.fill();
      if (a.isPlayer) {
        mm.strokeStyle = '#fff'; mm.lineWidth = 1.5;
        mm.beginPath(); mm.arc(px(a.body.pos.x), pz(a.body.pos.z), 5.5, 0, 7); mm.stroke();
        const fx = -Math.sin(a.body.yaw), fz = -Math.cos(a.body.yaw);
        mm.beginPath(); mm.moveTo(px(a.body.pos.x), pz(a.body.pos.z));
        mm.lineTo(px(a.body.pos.x) + fx * 9, pz(a.body.pos.z) + fz * 9); mm.stroke();
      }
    }
  }

  return {
    onPlay(h) { playHandler = h; },
    onRestart(h) { restartHandler = h; },
    onBuy(h) { buyHandler = h; },

    setHealth(hp) {
      if (last.hp === hp) return;
      last.hp = hp;
      el.healthFill.style.width = `${Math.max(0, hp)}%`;
      el.healthFill.style.background = hp > 50 ? '#e8a13a' : hp > 25 ? '#e06a1e' : '#d43a2a';
      el.healthNum.textContent = String(Math.max(0, Math.ceil(hp)));
    },
    setAmmo(mag, reserve, name) {
      setText(el.ammoMag, 'mag', String(mag));
      setText(el.ammoReserve, 'res', `/ ${reserve}`);
      setText(el.ammoName, 'wname', name);
    },
    setMoney(m) { setText(el.money, 'money', `$${m}`); },
    setTimer(sec, phase) {
      const s = Math.max(0, Math.ceil(sec));
      const mm2 = Math.floor(s / 60), ss = String(s % 60).padStart(2, '0');
      setText(el.timer, 'timer', `${mm2}:${ss}`);
      el.timer.style.color = s <= 10 && phase === 'live' ? '#ff5a3a' : '';
    },
    setScore(j, s, round) {
      setText(el.scoreJ, 'sj', String(j));
      setText(el.scoreS, 'ss', String(s));
      setText(el.roundLabel, 'round', `ROUND ${round} / 9`);
    },
    setBomb(text) { setText(el.bombStatus, 'bomb', text); },
    setCrosshairGap(px) {
      const g = Math.round(3 + px);
      el.crosshair.style.setProperty('--gap', `${g}px`);
    },
    hitMarker(head, holdMs = 110) {
      el.hitmarker.classList.add('on');
      el.hitmarker.classList.toggle('kill', head);
      clearTimeout(hitTimer);
      hitTimer = setTimeout(() => el.hitmarker.classList.remove('on', 'kill'), holdMs);
    },
    damageFlash(angleDeg) {
      el.vignette.style.opacity = '0.85';
      setTimeout(() => { el.vignette.style.opacity = '0'; }, 260);
      el.dirHit.style.transform = `translate(-50%,-50%) rotate(${angleDeg}deg)`;
      el.dirHit.style.opacity = '1';
      setTimeout(() => { el.dirHit.style.opacity = '0'; }, 700);
    },
    setPlant(progress, label) {
      if (progress <= 0) { el.plantBar.hidden = true; return; }
      el.plantBar.hidden = false;
      el.plantFill.style.width = `${Math.round(progress * 100)}%`;
      el.plantLabel.textContent = label;
    },
    setPips(jAlive, sAlive) {
      setText(el.pipsJ, 'pj', '●'.repeat(jAlive) + '○'.repeat(5 - jAlive));
      setText(el.pipsS, 'ps', '●'.repeat(sAlive) + '○'.repeat(5 - sAlive));
    },
    setSpectate(name) {
      el.spec.hidden = !name;
      if (name) el.spec.textContent = `Spectating ${name} — click to keep watching`;
    },
    feed(entries) {
      const html = entries.slice(-5).map((e) => `<div class="feed-row ${e.team}">${e.text}</div>`).join('');
      if (last.feed !== html) { last.feed = html; el.feed.innerHTML = html; }
    },
    banner(title, sub, holdMs = 3200) {
      el.bannerTitle.textContent = title;
      el.bannerSub.textContent = sub || '';
      el.banner.hidden = false;
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => { el.banner.hidden = true; }, holdMs);
    },
    hideBanner() { el.banner.hidden = true; clearTimeout(bannerTimer); },
    showBuy(open, money, owned) {
      el.buy.hidden = !open;
      if (!open) return;
      el.buyMoney.textContent = `$${money}`;
      for (const row of el.buyItems.children) {
        const item = BUY_ITEMS.find((i) => i.id === row.dataset.id);
        const afford = money >= item.price;
        const has = owned.includes(item.id);
        row.classList.toggle('cant', !afford && !has);
        row.classList.toggle('owned', has);
        row.querySelector('.buy-price').textContent = has ? 'OWNED' : `$${item.price}`;
      }
    },
    showOverlay(mode, data) {
      el.overlay.hidden = false;
      if (mode === 'start') {
        el.title.textContent = 'EMBERLINE';
        el.copy.textContent = 'Kiln Yard — Jackals plant the bomb, Sentinels hold the line. First to 5 rounds takes the yard.';
        el.play.textContent = 'Deploy';
        el.restart.hidden = true;
      } else if (mode === 'paused') {
        el.title.textContent = 'Paused';
        el.copy.textContent = 'The yard waits. Click to resume.';
        el.play.textContent = 'Resume';
        el.restart.hidden = false;
      } else if (mode === 'match') {
        el.title.textContent = data.win ? 'JACKALS TAKE THE YARD' : 'SENTINELS HOLD THE YARD';
        el.copy.textContent = `Final ${data.j} — ${data.s} · ${data.kills} eliminations · ${data.plants} plants`;
        el.play.textContent = 'Play again';
        el.restart.hidden = true;
      }
      el.settings.hidden = mode !== 'start' && mode !== 'paused';
    },
    hideOverlay() { el.overlay.hidden = true; },
    tickMinimap() { drawMinimap(); },
    setHudVisible(v) {
      document.getElementById('hud').style.visibility = v ? 'visible' : 'hidden';
    },
  };
}
