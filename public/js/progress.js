// Pure progression logic: days & streaks, XP & levels, achievements, skills.
// Operates on the plain `state` object; persistence lives in store.js.
import { OPS, OP_KEYS, DAILY_QUESTIONS } from './engine.js';

export const GOAL_OPTIONS = [10, 20, 30, 50];
export const GOAL_BONUS_XP = 250;
export const DAILY_BONUS_XP = 250;

export function emptyProgress() {
  return {
    xp: 0,
    days: {}, // 'YYYY-MM-DD' -> { correct, total, xp, sessions, met, dailyDone }
    ops: {}, // lifetime per-op { n, c, ms }
    daily: {}, // 'YYYY-MM-DD' -> first completed Daily Challenge { score, correct, ms, attempts, best }
    achievements: {}, // id -> unlocked timestamp
    records: {
      sessions: 0,
      goalsMet: 0,
      bestDayStreak: 0,
      combo: 0,
      sprintCorrect: 0,
      dailyCount: 0,
      dailyPerfect: 0,
      avgMs: null,
      score: {}, // per scoreKey(): 'daily', 'endless', 'sprint60', 'sprint180', 'sprint300'
    },
  };
}

/** Best-score bucket: each Sprint length keeps its own record (old sessions were all 60s). */
export const scoreKey = (s) => (s.mode === 'sprint' ? `sprint${s.sprintSec || 60}` : s.mode);

/* ---------------- days ---------------- */
const pad2 = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
export const keyToDate = (k) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (k, n) => {
  const d = keyToDate(k);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

/** Consecutive goal-met days ending today — or yesterday, while today is still open. */
export function dayStreak(days, today = dayKey()) {
  let k = days[today]?.met ? today : addDays(today, -1);
  let n = 0;
  while (days[k]?.met) {
    n++;
    k = addDays(k, -1);
  }
  return n;
}

/** Heatmap cells for the last `weeks` weeks (Monday-first columns), oldest first. */
export function heatmap(days, goal, weeks = 17, today = dayKey()) {
  const weekday = (keyToDate(today).getDay() + 6) % 7; // Mon=0
  const start = addDays(today, -weekday - 7 * (weeks - 1));
  const cells = [];
  for (let i = 0; i < weeks * 7; i++) {
    const key = addDays(start, i);
    const d = days[key];
    const correct = d?.correct || 0;
    let level = 0;
    if (d?.met) level = correct >= goal * 2 ? 4 : 3;
    else if (correct) level = correct >= goal / 2 ? 2 : 1;
    cells.push({ key, correct, level, today: key === today, future: key > today });
  }
  return cells;
}

/* ---------------- levels ---------------- */
export const xpToNext = (level) => Math.round((1000 * level ** 1.5) / 50) * 50;
const TITLES = [
  [1, 'Beginner'],
  [3, 'Counter'],
  [5, 'Calculator'],
  [8, 'Number Ninja'],
  [12, 'Math Wizard'],
  [16, 'Human Calculator'],
  [20, 'Grandmaster'],
];
export const titleFor = (level) => TITLES.filter(([l]) => level >= l).pop()[1];

export function levelInfo(xp) {
  let level = 1;
  let into = xp;
  while (into >= xpToNext(level)) {
    into -= xpToNext(level);
    level++;
  }
  return { level, into, need: xpToNext(level), title: titleFor(level) };
}

/* ---------------- achievements ---------------- */
const lifetimeCorrect = (state) => OP_KEYS.reduce((n, k) => n + (state.ops[k]?.c || 0), 0);

export function achievementContext(state) {
  return { r: state.records, correct: lifetimeCorrect(state), level: levelInfo(state.xp).level };
}

const streakDays = (c) => c.r.bestDayStreak;
const combo = (c) => c.r.combo;
const sprint = (c) => c.r.sprintCorrect;
const dailies = (c) => c.r.dailyCount;
const correct = (c) => c.correct;
const level = (c) => c.level;

// Progress achievements have `value(ctx)` + `goal`; one-off feats have `test(session)`.
export const ACHIEVEMENTS = [
  { id: 'first', icon: '🎯', name: 'First Steps', desc: 'Finish your first session', value: (c) => c.r.sessions, goal: 1 },
  { id: 'goal1', icon: '✅', name: 'Goal Getter', desc: 'Reach your daily goal', value: (c) => c.r.goalsMet, goal: 1 },
  { id: 'days3', icon: '🔥', name: 'Warming Up', desc: 'Reach a 3-day streak', value: streakDays, goal: 3 },
  { id: 'days7', icon: '📆', name: 'Week Warrior', desc: 'Reach a 7-day streak', value: streakDays, goal: 7 },
  { id: 'days30', icon: '🏅', name: 'Habit Formed', desc: 'Reach a 30-day streak', value: streakDays, goal: 30 },
  { id: 'days100', icon: '🏆', name: 'Centurion', desc: 'Reach a 100-day streak', value: streakDays, goal: 100 },
  { id: 'combo10', icon: '⚡', name: 'Combo ×10', desc: '10 correct answers in a row', value: combo, goal: 10 },
  { id: 'combo25', icon: '🌩️', name: 'Combo ×25', desc: '25 correct answers in a row', value: combo, goal: 25 },
  { id: 'combo50', icon: '🌪️', name: 'Unstoppable', desc: '50 correct answers in a row', value: combo, goal: 50 },
  { id: 'sprint20', icon: '⏱️', name: 'Sprinter', desc: '20 correct in a 1 min Sprint', value: sprint, goal: 20 },
  { id: 'sprint35', icon: '🏎️', name: 'Speed Demon', desc: '35 correct in a 1 min Sprint', value: sprint, goal: 35 },
  { id: 'daily1', icon: '📅', name: 'Daily Player', desc: 'Complete a Daily Challenge', value: dailies, goal: 1 },
  { id: 'daily10', icon: '🌟', name: 'Regular', desc: 'Complete 10 Daily Challenges', value: dailies, goal: 10 },
  {
    id: 'dailyPerfect',
    icon: '👑',
    name: 'Daily Perfect',
    desc: `${DAILY_QUESTIONS}/${DAILY_QUESTIONS} on a Daily Challenge`,
    value: (c) => c.r.dailyPerfect,
    goal: 1,
  },
  { id: 'c100', icon: '💯', name: 'Century', desc: '100 correct answers', value: correct, goal: 100 },
  { id: 'c1000', icon: '🧠', name: 'Big Brain', desc: '1,000 correct answers', value: correct, goal: 1000 },
  { id: 'c5000', icon: '🏛️', name: 'Mental Athlete', desc: '5,000 correct answers', value: correct, goal: 5000 },
  { id: 'lv5', icon: '⭐', name: 'Rising Star', desc: 'Reach level 5', value: level, goal: 5 },
  { id: 'lv10', icon: '🌠', name: 'Shooting Star', desc: 'Reach level 10', value: level, goal: 10 },
  { id: 'quick', icon: '🚀', name: 'Quick Draw', desc: 'Solve a × or ÷ in under 3 seconds', test: (s) => s.quick },
  {
    id: 'flawless',
    icon: '💎',
    name: 'Flawless',
    desc: '20+ answers in one session, no mistakes',
    test: (s) => s.total >= 20 && s.correct === s.total,
  },
  { id: 'owl', icon: '🦉', name: 'Night Owl', desc: 'Practice after 10 pm', test: (s) => new Date(s.ts).getHours() >= 22 },
  { id: 'bird', icon: '🐦', name: 'Early Bird', desc: 'Practice before 7 am', test: (s) => new Date(s.ts).getHours() < 7 },
];

function checkAchievements(state, session) {
  const ctx = achievementContext(state);
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (state.achievements[a.id]) continue;
    if (a.test ? a.test(session) : a.value(ctx) >= a.goal) {
      state.achievements[a.id] = session.ts + (session.durMs || 0);
      unlocked.push(a);
    }
  }
  return unlocked;
}

/* ---------------- sessions ---------------- */
/**
 * Fold a finished session into the state (mutates it). Returns everything the summary
 * screen needs to celebrate: XP breakdown, level change, goal/streak change, records, unlocks.
 */
export function applySession(state, s) {
  const r = state.records;
  const goal = state.settings.goal;
  const key = dayKey(new Date(s.ts));
  const xpBefore = state.xp;
  const streakBefore = dayStreak(state.days, key);

  const day = (state.days[key] ||= { correct: 0, total: 0, xp: 0, sessions: 0, met: false });
  day.correct += s.correct;
  day.total += s.total;
  day.sessions++;
  for (const [op, o] of Object.entries(s.byOp)) {
    const t = (state.ops[op] ||= { n: 0, c: 0, ms: 0 });
    t.n += o.n;
    t.c += o.c;
    t.ms += o.ms;
  }

  const bonuses = [];
  let goalJustMet = false;
  if (!day.met && day.correct >= goal) {
    day.met = true;
    goalJustMet = true;
    r.goalsMet++;
    bonuses.push({ id: 'goal', label: 'Daily goal reached', xp: GOAL_BONUS_XP });
  }

  // Daily Challenge: the first *completed* attempt of the day is the official result.
  let dailyRetry = false;
  if (s.mode === 'daily' && s.total >= DAILY_QUESTIONS) {
    const prev = state.daily[s.dailyKey];
    if (prev) {
      dailyRetry = true;
      prev.attempts++;
      prev.best = Math.max(prev.best, s.score);
    } else {
      state.daily[s.dailyKey] = { score: s.score, correct: s.correct, ms: s.answerMs, attempts: 1, best: s.score };
      day.dailyDone = true;
      r.dailyCount++;
      if (s.correct === s.total) r.dailyPerfect++;
      bonuses.push({ id: 'daily', label: 'Daily Challenge', xp: DAILY_BONUS_XP });
    }
  }

  const xpGained = s.score + bonuses.reduce((n, b) => n + b.xp, 0);
  state.xp += xpGained;
  day.xp += xpGained;

  // records ("new best" only counts when there was a previous best to beat)
  const best = {};
  const sk = scoreKey(s);
  const prevScore = r.score[sk] || 0;
  if (s.score > prevScore && !dailyRetry) {
    if (prevScore > 0) best.score = true;
    r.score[sk] = s.score;
  }
  if (s.bestStreak > r.combo) {
    if (r.combo > 0) best.combo = true;
    r.combo = s.bestStreak;
  }
  if (s.correct >= 5 && s.avgMs != null && (r.avgMs == null || s.avgMs < r.avgMs)) {
    if (r.avgMs != null) best.avg = true;
    r.avgMs = s.avgMs;
  }
  // Sprint achievements are tuned for the 60s sprint; longer sprints would make them trivial
  if (sk === 'sprint60') r.sprintCorrect = Math.max(r.sprintCorrect, s.correct);
  r.sessions++;

  const streak = dayStreak(state.days, key);
  r.bestDayStreak = Math.max(r.bestDayStreak, streak);

  return {
    xpGained,
    bonuses,
    before: levelInfo(xpBefore),
    after: levelInfo(state.xp),
    goalJustMet,
    day,
    dayStreak: streak,
    streakUp: streak > streakBefore,
    dailyRetry,
    best,
    unlocked: checkAchievements(state, s),
  };
}

/* ---------------- skills ---------------- */
/** Lifetime accuracy & speed per op, plus the weakest op once there is enough data. */
export function skillStats(state) {
  const ops = {};
  let weakest = null;
  let worst = -Infinity;
  let rated = 0;
  for (const k of OP_KEYS) {
    const o = state.ops[k] || { n: 0, c: 0, ms: 0 };
    const acc = o.n ? o.c / o.n : 0;
    const avgMs = o.c ? o.ms / o.c : null;
    ops[k] = { ...o, acc, avgMs };
    if (o.n >= 10 && avgMs != null) {
      rated++;
      // mistakes weigh double; time is relative to the op's par so ÷ isn't always "worst"
      const weakness = (1 - acc) * 2 + avgMs / 1000 / OPS[k].par;
      if (weakness > worst) {
        worst = weakness;
        weakest = k;
      }
    }
  }
  return { ops, weakest: rated >= 2 ? weakest : null };
}
