// Persistence (localStorage) with an in-memory fallback if storage is blocked.
import { OP_KEYS, SPRINT_SECONDS, DAILY_DIFFS, DEFAULT_DIFF, dailyId } from './engine.js';
import { emptyProgress, applySession } from './progress.js';

const KEY = 'mathmind.v2';
const V1_KEY = 'mathmind.v1';
const PENDING_KEY = 'mathmind.pending';
const MAX_SESSIONS = 300;

export function defaults() {
  return {
    v: 2,
    settings: { ops: [...OP_KEYS], level: 'd23', sprintSec: 60, dailyDiff: DEFAULT_DIFF, sound: true, haptics: true, phonePad: false, goal: 20, name: '', avatar: '', lang: '' },
    history: [],
    ...emptyProgress(),
  };
}

/** Normalise a parsed object (saved state or imported backup) into a full v2 state. */
export function hydrate(obj) {
  if (!obj || typeof obj !== 'object') throw new Error('Not a MathMind backup');
  if (obj.v !== 2) return migrateV1(obj);
  const st = defaults();
  Object.assign(st.settings, obj.settings);
  for (const k of ['history', 'days', 'ops', 'daily', 'achievements']) {
    if (obj[k] && typeof obj[k] === 'object') st[k] = obj[k];
  }
  st.xp = Number(obj.xp) || 0;
  Object.assign(st.records, obj.records, { score: { ...obj.records?.score } });
  // before Sprint lengths existed, every sprint was 60s and its best lived under 'sprint'
  const score = st.records.score;
  if ('sprint' in score) {
    score.sprint60 = Math.max(score.sprint60 || 0, score.sprint || 0);
    delete score.sprint;
  }
  // likewise the Daily Challenge: it was one medium set per date, with its best under 'daily'
  if ('daily' in score) {
    score.daily_medium = Math.max(score.daily_medium || 0, score.daily || 0);
    delete score.daily;
  }
  for (const k of Object.keys(st.daily)) {
    if (!k.includes(':')) {
      st.daily[dailyId(k)] = st.daily[k];
      delete st.daily[k];
    }
  }
  if (!SPRINT_SECONDS.includes(st.settings.sprintSec)) st.settings.sprintSec = 60;
  if (!(st.settings.dailyDiff in DAILY_DIFFS)) st.settings.dailyDiff = DEFAULT_DIFF;
  return st;
}

/** v1 only stored settings + a session list: replay it to rebuild days, XP, records. */
export function migrateV1(old) {
  if (!Array.isArray(old.history)) throw new Error('Not a MathMind backup');
  const st = defaults();
  Object.assign(st.settings, old.settings);
  for (const s of [...old.history].reverse()) {
    const session = { ...s, mode: s.mode || 'endless' };
    session.xp = applySession(st, session).xpGained;
    st.history.unshift(session);
  }
  return st;
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return hydrate(JSON.parse(raw));
    const v1 = localStorage.getItem(V1_KEY);
    if (v1) {
      const st = migrateV1(JSON.parse(v1));
      save(st);
      return st;
    }
  } catch {
    /* corrupted or unavailable storage: start fresh */
  }
  return defaults();
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function addSession(state, session) {
  state.history.unshift(session);
  state.history.length = Math.min(state.history.length, MAX_SESSIONS);
  save(state);
}

export function resetAll() {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(V1_KEY);
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}

// In-progress session snapshot, so closing the app mid-game doesn't lose answers.
export function savePending(snapshot) {
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(snapshot));
  } catch {
    /* ignore */
  }
}
export function clearPending() {
  try {
    localStorage.removeItem(PENDING_KEY);
  } catch {
    /* ignore */
  }
}
export function takePending() {
  try {
    const p = JSON.parse(localStorage.getItem(PENDING_KEY) || 'null');
    localStorage.removeItem(PENDING_KEY);
    return p;
  } catch {
    return null;
  }
}
