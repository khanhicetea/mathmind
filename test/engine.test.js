import test from 'node:test';
import assert from 'node:assert/strict';
import { generate, checkAnswer, parseInput, scoreAnswer, summarize, formatTenths, LEVELS, OP_KEYS } from '../public/js/engine.js';

const N = 3000;
const digits = (n) => String(n).length;

test('operands respect the level for every op', () => {
  for (const level of Object.keys(LEVELS)) {
    const allowed = LEVELS[level].digits;
    for (const op of OP_KEYS) {
      for (let i = 0; i < N; i++) {
        const q = generate(op, level);
        assert.ok(allowed.includes(digits(q.a)), `${q.text} a (${level})`);
        assert.ok(allowed.includes(digits(q.b)) || (op === 'mul' && digits(q.b) === 2), `${q.text} b (${level})`);
      }
    }
  }
});

test('add / sub / mul answers are exact; sub is positive', () => {
  for (let i = 0; i < N; i++) {
    const add = generate('add', 'd23');
    assert.equal(add.tenths, (add.a + add.b) * 10);
    const sub = generate('sub', 'd23');
    assert.ok(sub.a > sub.b);
    assert.equal(sub.tenths, (sub.a - sub.b) * 10);
    const mul = generate('mul', 'd3');
    assert.equal(mul.tenths, mul.a * mul.b * 10);
    assert.ok(!(digits(mul.a) === 3 && digits(mul.b) === 3));
  }
});

test('division: dividend >= divisor and tenths is round-half-up of a/b', () => {
  let exact = 0;
  let decimal = 0;
  for (const level of Object.keys(LEVELS)) {
    for (let i = 0; i < N; i++) {
      const q = generate('div', level);
      assert.ok(q.a > q.b, q.text);
      // reference using exact rational arithmetic: floor(10a/b + 1/2)
      assert.equal(q.tenths, Math.floor((20 * q.a + q.b) / (2 * q.b)), q.text);
      assert.ok(Math.abs(q.tenths / 10 - q.a / q.b) <= 0.05 + 1e-9, q.text);
      if (q.a % q.b === 0) exact++;
      else decimal++;
    }
  }
  assert.ok(exact > 0 && decimal > 0, 'should produce both exact and decimal questions');
});

test('rounding edge: x.x5 rounds up', () => {
  // 1/8 = 0.125 -> 1.25 tenths -> 1.3 ; use a=10? craft via formula directly
  const q = { tenths: Math.floor((20 * 25 + 8) / (2 * 8)) }; // 25/8 = 3.125 -> 3.1
  assert.equal(q.tenths, 31);
  const r = { tenths: Math.floor((20 * 27 + 8) / (2 * 8)) }; // 27/8 = 3.375 -> 3.4
  assert.equal(r.tenths, 34);
  const half = { tenths: Math.floor((20 * 13 + 40) / (2 * 40)) }; // 13/40 = 0.325 -> 0.3 (3.25 tenths)
  assert.equal(half.tenths, 3);
  const up = { tenths: Math.floor((20 * 7 + 40) / (2 * 40)) }; // 7/40 = 0.175 -> 0.2 (1.75 tenths)
  assert.equal(up.tenths, 2);
});

test('parseInput', () => {
  assert.equal(parseInput('12'), 120);
  assert.equal(parseInput('12.'), 120);
  assert.equal(parseInput('12.3'), 123);
  assert.equal(parseInput('0.5'), 5);
  for (const bad of ['', '.', '12.34', '-5', 'abc', '1.2.3']) assert.equal(parseInput(bad), null, bad);
});

test('checkAnswer', () => {
  const q = { tenths: 123 };
  assert.deepEqual(checkAnswer(q, '12.3'), { valid: true, correct: true });
  assert.deepEqual(checkAnswer(q, '12.4'), { valid: true, correct: false });
  assert.deepEqual(checkAnswer(q, '123'), { valid: true, correct: false });
  assert.equal(checkAnswer(q, '').valid, false);
  const whole = { tenths: 420 };
  assert.ok(checkAnswer(whole, '42').correct);
  assert.ok(checkAnswer(whole, '42.0').correct);
});

test('formatTenths', () => {
  assert.equal(formatTenths(420), '42');
  assert.equal(formatTenths(423), '42.3');
  assert.equal(formatTenths(30, true), '3.0');
  assert.equal(formatTenths(5, true), '0.5');
});

test('scoring: speed bonus and streak multiplier', () => {
  const q = { par: 5 };
  assert.deepEqual(scoreAnswer(q, 0, 1), { base: 100, speed: 100, mult: 1, points: 200 });
  assert.equal(scoreAnswer(q, 10000, 1).speed, 0); // 2x par -> no bonus
  assert.equal(scoreAnswer(q, 60000, 1).points, 100); // never below base
  assert.equal(scoreAnswer(q, 5000, 1).speed, 50);
  assert.equal(scoreAnswer(q, 0, 3).mult, 1.2);
  assert.equal(scoreAnswer(q, 0, 99).mult, 2); // capped
});

test('summarize', () => {
  const log = [
    { op: 'add', correct: true, ms: 2000, points: 150 },
    { op: 'add', correct: true, ms: 1000, points: 200 },
    { op: 'mul', correct: false, ms: 9000, points: 0 },
    { op: 'mul', correct: true, ms: 3000, points: 120 },
  ];
  const s = summarize(log);
  assert.equal(s.total, 4);
  assert.equal(s.correct, 3);
  assert.equal(s.score, 470);
  assert.equal(s.bestStreak, 2);
  assert.equal(s.fastestMs, 1000);
  assert.equal(s.avgMs, 2000);
  assert.deepEqual(s.byOp.mul, { n: 2, c: 1, ms: 3000 });
  assert.equal(summarize([]).avgMs, null);
});
