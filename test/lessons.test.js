import test from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, summarize, checkAnswer } from '../public/js/engine.js';
import {
  LESSONS,
  READY,
  LESSON_QUESTIONS,
  LESSON_BONUS_XP,
  TABLE_RULES,
  tableRule,
  tableKeepers,
  tableExplain,
  rebuild,
  lessonQuestions,
} from '../public/js/lessons.js';
import { applySession, scoreKey } from '../public/js/progress.js';
import { defaults, hydrate } from '../public/js/store.js';

test('the times table shrinks 81 → 64 → 49 → 36 → 25 → 15', () => {
  const left = [];
  for (let step = 0; step <= TABLE_RULES; step++) {
    let n = 0;
    for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) if (!(tableRule(a, b) && tableRule(a, b) <= step)) n++;
    left.push(n);
  }
  assert.deepEqual(left, [81, 64, 49, 36, 25, 15]);
  assert.equal(tableKeepers().length, 15);
  for (const [a, b] of tableKeepers()) assert.ok(a >= b && ![1, 2, 5, 9].includes(a) && ![1, 2, 5, 9].includes(b));
});

test('every keeper but 7 × 7 can be rebuilt, and the rebuild ends on the answer', () => {
  for (const [a, b] of tableKeepers()) {
    const r = rebuild(a, b);
    if (a === 7 && b === 7) assert.equal(r, null);
    else assert.ok(r.endsWith(String(a * b)), `${a}×${b}: ${r}`);
  }
  assert.equal(rebuild(8, 7), '×2 ×2 ×2: 7 → 14 → 28 → 56');
  assert.equal(rebuild(7, 6), '5 × 7 + 7 = 35 + 7 = 42');
});

test('tableExplain ends every equation on the product', () => {
  for (let a = 1; a <= 9; a++) {
    for (let b = 1; b <= 9; b++) {
      const ex = tableExplain(a, b);
      assert.equal(ex.rule, tableRule(a, b));
      assert.equal(ex.eq.at(-1), `= ${a * b}`);
    }
  }
  assert.deepEqual(tableExplain(7, 9).eq, ['7 × 9', '= 70 − 7', '= 63']);
});

test('lesson practice sets are game-ready, distinct and come with a tip', () => {
  for (const id of READY) {
    for (let seed = 1; seed <= 20; seed++) {
      const qs = lessonQuestions(id, mulberry32(seed));
      assert.equal(qs.length, LESSON_QUESTIONS);
      assert.equal(new Set(qs.map((q) => q.text)).size, LESSON_QUESTIONS);
      for (const q of qs) {
        assert.equal(q.op, LESSONS[id].op);
        assert.ok(checkAnswer(q, q.answerText).correct);
        assert.ok(q.tip.endsWith(q.answerText), q.tip);
      }
    }
  }
  // split: 2-digit × 1-digit, never a round number
  for (const q of lessonQuestions('split', mulberry32(7))) assert.ok(q.a >= 12 && q.a <= 98 && q.a % 10 && q.b >= 3 && q.b <= 9);
  assert.throws(() => lessonQuestions('nope'));
});

test('every lesson is ready, with captions for each step and a right answer in each ask', async () => {
  globalThis.document ??= { documentElement: {} }; // setLang sets <html lang>
  const { setLang, t, LANGS } = await import('../public/js/i18n.js');
  assert.equal(READY.length, Object.keys(LESSONS).length);
  for (const lang of Object.keys(LANGS)) {
    setLang(lang);
    for (const id of READY) assert.equal(t(`ln.${id}.steps`).length, LESSONS[id].steps, `${lang} ${id}`);
  }
  for (const l of Object.values(LESSONS)) for (const s of l.demo || []) if (s.ask) assert.ok(s.ask[1].includes(s.ask[2]), l.id);
});

const lessonSession = (lesson, n, ok = n) => ({
  ts: new Date(2026, 9, 14, 12).getTime(),
  durMs: 30000,
  mode: 'lesson',
  lesson,
  ops: ['mul'],
  level: null,
  quick: false,
  ...summarize(Array.from({ length: n }, (_, i) => ({ op: 'mul', correct: i < ok, ms: 2000, points: i < ok ? 150 : 0 }))),
});

test('a finished lesson practice completes the lesson once, with a bonus and an award', () => {
  const st = defaults();
  const r1 = applySession(st, lessonSession('table', LESSON_QUESTIONS, 4));
  assert.ok(r1.lessonFirst);
  assert.deepEqual(r1.bonuses.map((b) => b.id), ['lesson']);
  assert.equal(r1.xpGained, 4 * 150 + LESSON_BONUS_XP);
  assert.equal(st.lessons.table.best, 4);
  assert.ok(r1.unlocked.some((a) => a.id === 'learn1'));
  assert.equal(st.records.score[scoreKey({ mode: 'lesson', lesson: 'table' })], 600);

  const r2 = applySession(st, lessonSession('table', LESSON_QUESTIONS));
  assert.ok(!r2.lessonFirst);
  assert.equal(r2.bonuses.length, 0);
  assert.equal(st.lessons.table.best, LESSON_QUESTIONS);
});

test('a stopped lesson practice does not complete the lesson', () => {
  const st = defaults();
  const r = applySession(st, lessonSession('split', 3));
  assert.ok(!r.lessonFirst);
  assert.deepEqual(st.lessons, {});
});

test('lesson progress survives a backup round-trip, and old backups get an empty map', () => {
  const st = defaults();
  applySession(st, lessonSession('split', LESSON_QUESTIONS));
  assert.ok(hydrate(JSON.parse(JSON.stringify(st))).lessons.split);
  const old = JSON.parse(JSON.stringify(defaults()));
  delete old.lessons;
  assert.deepEqual(hydrate(old).lessons, {});
});
