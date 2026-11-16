// EMBERLINE — the single game state. Every module reads and writes this one
// object; nothing else holds match state, so a round can restart by resetting it.
import { TUNING } from './palette.js';

export function createState(rng) {
  return {
    rng,
    time: 0, // simulation seconds since match start
    lastShot: null, // {x, y, z, t, team} of the most recent shot, for bot hearing
    phase: 'menu', // menu | freeze | live | roundEnd | matchEnd
    phaseTime: 0,
    round: 1,
    score: { jackals: 0, sentinels: 0 },
    roundTimeLeft: TUNING.roundSeconds,
    money: TUNING.startMoney,
    kills: 0,
    deaths: 0,
    plants: 0,
    bomb: {
      state: 'carried', // carried | planted | detonated | defused | dropped
      carrier: null, // agent carrying it, or null
      site: null, // 'A' | 'B' | null
      x: 0,
      z: 0,
      timer: 0, // counts down while planted
      progress: 0, // 0..1 plant/defuse progress
      actor: null, // agent currently planting/defusing
    },
    roundWinner: null,
    roundReason: '',
    matchWinner: null,
    feed: [], // killfeed entries {text, team, t}
    events: [], // transient events consumed by HUD/audio each step
    smokes: [], // {x, y, z, r, ttl}
    agents: [], // all 10 agents; agents[0] is always the player
    player: null,
    spectate: null, // agent followed while the player is dead
    paused: false,
    muted: false,
    sensitivity: 1,
    volume: 0.8,
    freezeLeft: 0,
  };
}

export function resetRoundState(S) {
  S.roundTimeLeft = TUNING.roundSeconds;
  S.bomb.state = 'carried';
  S.bomb.carrier = null;
  S.bomb.site = null;
  S.bomb.timer = 0;
  S.bomb.progress = 0;
  S.bomb.actor = null;
  S.roundWinner = null;
  S.roundReason = '';
  S.smokes.length = 0;
  S.spectate = null;
  S.freezeLeft = TUNING.freezeSeconds;
}
