// EMBERLINE — synthesized audio only (no audio files). Every sound is built
// from oscillators and filtered noise in a WebAudio graph, so the game ships
// zero audio assets and loads nothing over the network.
export function createAudio() {
  let ctx = null;
  let master = null;
  let noiseBuf = null;
  let volume = 0.8;
  let muted = false;
  let humNodes = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : volume;
      master.connect(ctx.destination);
      const len = ctx.sampleRate;
      noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    } catch {
      return false;
    }
    return true;
  }

  function burst(dur, filterFreq, type, gain, when = 0) {
    if (!ensure() || !ctx) return;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(master);
    src.start(t); src.stop(t + dur + 0.02);
  }

  function tone(freq, dur, type, gain, slideTo = 0, when = 0) {
    if (!ensure() || !ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g); g.connect(master);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  const SHOTS = {
    rifle: () => { burst(0.14, 900, 'lowpass', 0.5); burst(0.05, 3200, 'highpass', 0.22); },
    smg: () => { burst(0.1, 1100, 'lowpass', 0.42); burst(0.04, 3600, 'highpass', 0.18); },
    sniper: () => { burst(0.3, 500, 'lowpass', 0.7); burst(0.12, 2400, 'highpass', 0.3); tone(140, 0.18, 'sawtooth', 0.12, 60); },
    shotgun: () => { burst(0.22, 700, 'lowpass', 0.65); burst(0.08, 1800, 'highpass', 0.28); },
    pistol: () => { burst(0.1, 1300, 'lowpass', 0.4); burst(0.04, 3800, 'highpass', 0.16); },
  };

  return {
    unlock() { ensure(); },
    setVolume(v) { volume = v; if (master) master.gain.value = muted ? 0 : v; },
    setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : volume; },
    shot(kind, dist = 0) {
      if (!ensure()) return;
      const g = Math.max(0.12, 1 - dist / 60);
      const save = volume;
      volume = save * g;
      if (master) master.gain.value = muted ? 0 : volume;
      (SHOTS[kind] || SHOTS.rifle)();
      volume = save;
      if (master) master.gain.value = muted ? 0 : volume;
    },
    dryFire() { tone(1800, 0.03, 'square', 0.1); },
    reload() { tone(900, 0.04, 'square', 0.12); tone(600, 0.05, 'square', 0.12, 0, 0.35); tone(1200, 0.04, 'square', 0.12, 0, 0.7); },
    hit(head) { tone(head ? 2400 : 1500, 0.06, 'triangle', 0.22, head ? 1800 : 1100); },
    kill() { tone(520, 0.09, 'triangle', 0.2, 780); tone(780, 0.12, 'triangle', 0.18, 1040, 0.08); },
    hurt() { burst(0.12, 300, 'lowpass', 0.4); tone(110, 0.15, 'sawtooth', 0.18, 70); },
    step(run) { burst(0.05, run ? 500 : 380, 'lowpass', run ? 0.1 : 0.07); },
    beep(urgent) { tone(urgent ? 1250 : 950, 0.09, 'square', 0.16); },
    plantTick() { tone(700, 0.05, 'square', 0.14); },
    plantDone() { tone(440, 0.1, 'triangle', 0.2); tone(660, 0.14, 'triangle', 0.2, 0, 0.1); },
    explosion() {
      burst(0.9, 220, 'lowpass', 0.9);
      burst(0.4, 1200, 'highpass', 0.3);
      tone(55, 0.8, 'sine', 0.5, 30);
    },
    roundWin() { [523, 659, 784].forEach((f, i) => tone(f, 0.16, 'triangle', 0.2, 0, i * 0.11)); },
    roundLose() { [392, 330, 262].forEach((f, i) => tone(f, 0.18, 'triangle', 0.18, 0, i * 0.12)); },
    buy() { tone(880, 0.06, 'triangle', 0.16); tone(1174, 0.08, 'triangle', 0.16, 0, 0.06); },
    grenadeThrow() { burst(0.08, 900, 'bandpass', 0.15); },
    startHum() {
      if (!ensure() || humNodes) return;
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth'; osc.frequency.value = 52;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 120;
      const g = ctx.createGain(); g.gain.value = 0.035;
      osc.connect(filter); filter.connect(g); g.connect(master);
      osc.start();
      humNodes = { osc, g };
    },
  };
}
