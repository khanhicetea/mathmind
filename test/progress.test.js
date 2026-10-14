import test from 'node:test';
import assert from 'node:assert/strict';
import { dailyQuestions, summarize, dailyId, DAILY_QUESTIONS, DAILY_DIFFS, DAILY_DIFF_KEYS } from '../public/js/engine.js';
import {
  dayKey,
  addDays,
  dayStreak,
  levelInfo,
  xpToNext,
  heatmap,
  applySession,
  skillStats,
  GOAL_BONUS_XP,
} from '../public/js/progress.js';
import { defaults, hydrate, migrateV1 } from '../public/js/store.js';

// build a session the way app.js does
const at = (key, hour = 12) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, hour).getTime();
};
function session(key, log, extra = {}) {
  return { ts: at(key, extra.hour), durMs: 60000, mode: 'endless', ops: ['add'], level: 'd23', quick: false, ...summarize(log), ...extra };
}
const answers = (n, ok = true, op = 'add', ms = 2000) => Array.from({ length: n }, () => ({ op, correct: ok, ms, points: ok ? 150 : 0 }));

test('dayKey / addDays handle month and year boundaries', () => {
  assert.equal(dayKey(new Date(2026, 0, 5)), '2026-01-05');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(addDays('2024-03-01', -1), '2024-02-29');
  assert.equal(addDays('2026-12-31', 1), '2027-01-01');
});

test('dayStreak counts met days and survives an open "today"', () => {
  const days = { '2026-10-11': { met: true }, '2026-10-12': { met: true }, '2026-10-13': { met: true } };
  assert.equal(dayStreak(days, '2026-10-13'), 3); // done today
  assert.equal(dayStreak(days, '2026-10-14'), 3); // today not done yet: still alive
  assert.equal(dayStreak(days, '2026-10-15'), 0); // missed yesterday: broken
  days['2026-10-12'].met = false;
  assert.equal(dayStreak(days, '2026-10-13'), 1);
});

test('levels: thresholds and titles', () => {
  assert.deepEqual(levelInfo(0), { level: 1, into: 0, need: xpToNext(1), title: 'Beginner' });
  assert.equal(levelInfo(xpToNext(1)).level, 2);
  assert.equal(levelInfo(xpToNext(1) - 1).level, 1);
  const toL5 = [1, 2, 3, 4].reduce((n, l) => n + xpToNext(l), 0);
  assert.equal(levelInfo(toL5).level, 5);
  assert.equal(levelInfo(toL5).title, 'Calculator');
});

test('applySession: goal bonus once per day, streak, records', () => {
  const st = defaults(); // goal 20
  let res = applySession(st, session('2026-10-13', answers(12)));
  assert.equal(res.goalJustMet, false);
  assert.equal(res.xpGained, 12 * 150);
  res = applySession(st, session('2026-10-13', answers(10)));
  assert.equal(res.goalJustMet, true, '12 + 10 >= 20');
  assert.equal(res.xpGained, 10 * 150 + GOAL_BONUS_XP);
  assert.equal(res.dayStreak, 1);
  assert.equal(res.streakUp, true);
  res = applySession(st, session('2026-10-13', answers(25)));
  assert.equal(res.goalJustMet, false, 'bonus only once a day');
  res = applySession(st, session('2026-10-14', answers(20)));
  assert.equal(res.dayStreak, 2);
  assert.equal(st.records.bestDayStreak, 2);
  assert.equal(st.records.combo, 25);
  assert.equal(st.records.sessions, 4);
  assert.equal(st.ops.add.c, 67);
  assert.equal(st.xp, 67 * 150 + 2 * GOAL_BONUS_XP);
});

test('applySession: "new best" flags only when beating a previous best', () => {
  const st = defaults();
  let res = applySession(st, session('2026-10-13', answers(3)));
  assert.deepEqual(res.best, {});
  res = applySession(st, session('2026-10-13', answers(5)));
  assert.equal(res.best.score, true);
  assert.equal(res.best.combo, true);
  res = applySession(st, session('2026-10-13', answers(2)));
  assert.deepEqual(res.best, {});
});

test('applySession: daily challenge — first completed attempt is official', () => {
  const st = defaults();
  const key = '2026-10-14';
  const id = dailyId(key, 'medium');
  const daily = { mode: 'daily', dailyKey: key, diff: 'medium' };
  // stopped early: not a completion
  let res = applySession(st, session(key, answers(5), daily));
  assert.equal(st.daily[id], undefined);
  res = applySession(st, session(key, answers(DAILY_QUESTIONS), daily));
  assert.ok(res.bonuses.some((b) => b.xp === DAILY_DIFFS.medium.bonusXp));
  assert.equal(st.records.dailyCount, 1);
  assert.equal(st.records.dailyPerfect, 1);
  assert.equal(st.days[key].dailyDone, true);
  const official = st.daily[id].score;
  res = applySession(st, session(key, answers(DAILY_QUESTIONS), daily));
  assert.equal(res.dailyRetry, true);
  assert.equal(st.daily[id].attempts, 2);
  assert.equal(st.daily[id].score, official);
  assert.equal(st.records.dailyCount, 1);
});

test('applySession: each daily difficulty has its own result, best score and bonus', () => {
  const st = defaults();
  const key = '2026-10-14';
  for (const diff of DAILY_DIFF_KEYS) {
    const res = applySession(st, session(key, answers(DAILY_QUESTIONS), { mode: 'daily', dailyKey: key, diff }));
    assert.equal(res.dailyRetry, false, diff);
    assert.ok(res.bonuses.some((b) => b.id === 'daily' && b.xp === DAILY_DIFFS[diff].bonusXp), diff);
    assert.ok(st.records.score[`daily_${diff}`] > 0, diff);
  }
  assert.deepEqual(Object.keys(st.daily).sort(), DAILY_DIFF_KEYS.map((d) => dailyId(key, d)).sort());
  assert.equal(st.records.dailyCount, 3);
  // a session saved before difficulties existed counts as medium
  const old = applySession(defaults(), session(key, answers(DAILY_QUESTIONS), { mode: 'daily', dailyKey: key }));
  assert.ok(old.bonuses.some((b) => b.xp === DAILY_DIFFS.medium.bonusXp));
});

test('achievements unlock once, with progress and one-off feats', () => {
  const st = defaults();
  let res = applySession(st, session('2026-10-14', answers(10), { hour: 23, quick: true }));
  const ids = res.unlocked.map((a) => a.id);
  for (const id of ['first', 'combo10', 'quick', 'owl']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('bird'));
  res = applySession(st, session('2026-10-14', answers(10), { hour: 23, quick: true }));
  assert.ok(!res.unlocked.some((a) => a.id === 'first' || a.id === 'owl'), 'no re-unlock');
  assert.ok(res.unlocked.some((a) => a.id === 'goal1'));
});

test('skillStats picks the weakest op relative to par', () => {
  const st = defaults();
  applySession(st, session('2026-10-14', [...answers(20, true, 'add', 2000), ...answers(20, true, 'mul', 4000)]));
  assert.equal(skillStats(st).weakest, 'add', 'add at 2s (par 5) is slower relative to par than mul at 4s (par 11)');
  applySession(st, session('2026-10-14', answers(20, false, 'mul', 4000)));
  assert.equal(skillStats(st).weakest, 'mul', 'mistakes weigh heavily');
  assert.equal(skillStats(defaults()).weakest, null, 'needs data');
});

test('heatmap is Monday-aligned and marks future days', () => {
  const cells = heatmap({ '2026-10-14': { correct: 45, met: true } }, 20, 2, '2026-10-14'); // a Wednesday
  assert.equal(cells.length, 14);
  assert.equal(cells[0].key, '2026-10-05'); // Monday of the previous week
  const today = cells.find((c) => c.today);
  assert.equal(today.level, 4);
  assert.equal(cells.filter((c) => c.future).length, 4); // Thu..Sun
});

test('daily questions: each difficulty is its own deterministic, suitably hard set', () => {
  const key = '2026-10-14';
  const texts = (d) => dailyQuestions(key, d).map((q) => q.text);
  const sets = DAILY_DIFF_KEYS.map(texts);
  assert.notDeepEqual(sets[0], sets[1]);
  assert.notDeepEqual(sets[1], sets[2]);
  for (const d of DAILY_DIFF_KEYS) assert.deepEqual(texts(d), texts(d), d);

  const digits = (n) => String(n).length;
  const maxDigits = (d) => Math.max(...dailyQuestions(key, d).flatMap((q) => [digits(q.a), digits(q.b)]));
  assert.ok(maxDigits('easy') <= 2);
  assert.equal(maxDigits('hard'), 3);
  for (const q of dailyQuestions(key, 'hard')) assert.ok(digits(q.a) === 3 && (digits(q.b) === 3 || q.op === 'mul'), q.text);
  for (const k of ['2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17']) {
    for (const q of dailyQuestions(k, 'easy')) {
      assert.ok(q.a > 1 && q.b > 1, q.text);
      if (q.op === 'mul') assert.ok(digits(q.a) + digits(q.b) <= 3, q.text);
      if (q.op === 'div') {
        assert.equal(q.a % q.b, 0, q.text);
        assert.ok(q.whole && !q.answerText.includes('.'), q.text);
      }
    }
  }
});

test('medium daily set is unchanged from before difficulties existed', () => {
  assert.deepEqual(
    dailyQuestions('2026-10-14', 'medium').map((q) => q.text),
    dailyQuestions('2026-10-14').map((q) => q.text),
  );
});

test('daily questions are deterministic per date and balanced', () => {
  const a = dailyQuestions('2026-10-14').map((q) => q.text);
  const b = dailyQuestions('2026-10-14').map((q) => q.text);
  const c = dailyQuestions('2026-10-15').map((q) => q.text);
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
  assert.equal(a.length, DAILY_QUESTIONS);
  assert.equal(new Set(a).size, DAILY_QUESTIONS);
  const ops = dailyQuestions('2026-10-14').map((q) => q.op);
  for (const op of ['add', 'sub', 'mul', 'div']) assert.ok(ops.filter((o) => o === op).length >= 3, op);
});

test('migrateV1 replays old history; hydrate round-trips', () => {
  const v1 = {
    settings: { ops: ['add', 'mul'], level: 'd2', sound: false },
    history: [
      // newest first, like v1 stored it
      { ...session('2026-10-13', answers(22)), mode: undefined },
      { ...session('2026-10-12', answers(21)), mode: undefined },
    ],
  };
  const st = migrateV1(v1);
  assert.equal(st.settings.level, 'd2');
  assert.equal(st.settings.goal, 20);
  assert.equal(st.history.length, 2);
  assert.equal(st.history[0].ts, v1.history[0].ts, 'order kept');
  assert.equal(st.history[0].mode, 'endless');
  assert.equal(st.records.bestDayStreak, 2);
  assert.ok(st.xp > 0);
  const again = hydrate(JSON.parse(JSON.stringify(st)));
  assert.deepEqual(again, st);
  assert.throws(() => hydrate({ foo: 1 }));
});

test('each Sprint length keeps its own best; achievements only count 1 min sprints', () => {
  const st = defaults();
  applySession(st, session('2026-10-13', answers(10), { mode: 'sprint', sprintSec: 60 }));
  const long = applySession(st, session('2026-10-13', answers(40), { mode: 'sprint', sprintSec: 300 }));
  assert.equal(st.records.score.sprint60, 1500);
  assert.equal(st.records.score.sprint300, 6000);
  assert.ok(!long.best.score, 'first 5 min sprint is not a "new best" over the 1 min one');
  assert.equal(st.records.sprintCorrect, 10);
  assert.ok(!st.achievements.sprint35);
  // sessions saved before lengths existed count as 1 min
  applySession(st, session('2026-10-13', answers(12), { mode: 'sprint' }));
  assert.equal(st.records.score.sprint60, 1800);
});

test('hydrate moves the old single Sprint best to the 1 min bucket', () => {
  const st = hydrate({ v: 2, settings: { sprintSec: 999 }, records: { score: { sprint: 900 } } });
  assert.deepEqual(st.records.score, { sprint60: 900 });
  assert.equal(st.settings.sprintSec, 60);
});

test('hydrate files pre-difficulty Daily Challenge data under medium', () => {
  const old = { v: 2, settings: { dailyDiff: 'nope' }, daily: { '2026-10-13': { score: 1, correct: 15, attempts: 1, best: 1 } }, records: { score: { daily: 50 } } };
  const st = hydrate(old);
  assert.deepEqual(Object.keys(st.daily), ['2026-10-13:medium']);
  assert.deepEqual(st.records.score, { daily_medium: 50 });
  assert.equal(st.settings.dailyDiff, 'medium');
  assert.equal(hydrate({ v: 2, settings: { dailyDiff: 'hard' } }).settings.dailyDiff, 'hard');
});
