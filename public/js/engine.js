// Pure game logic: question generation, answer checking, scoring.
// No DOM / storage access so it can be unit-tested under node.

export const OPS = {
  add: { sym: '+', label: 'Add', par: 5 },
  sub: { sym: '−', label: 'Subtract', par: 5 },
  mul: { sym: '×', label: 'Multiply', par: 11 },
  div: { sym: '÷', label: 'Divide', par: 12 },
};
export const OP_KEYS = Object.keys(OPS);

// `digits` is the pool of digit-counts an operand is drawn from.
export const LEVELS = {
  d2: { label: '2 digits', digits: [2] },
  d23: { label: '2–3 digits', digits: [2, 3] },
  d3: { label: '3 digits', digits: [3] },
};

export const MODES = {
  daily: { label: 'Daily Challenge', icon: '📅' },
  sprint: { label: 'Sprint', icon: '⏱️' },
  endless: { label: 'Endless', icon: '♾️' },
};
export const DAILY_QUESTIONS = 15;
export const SPRINT_SECONDS = [60, 180, 300];
export const sprintLabel = (sec) => (sec % 60 ? `${sec}s` : `${sec / 60} min`);
export const RESULT_PAUSE_MS = 1000;

/** Small seeded PRNG so the Daily Challenge is identical for everyone on a given date. */
export function mulberry32(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The fixed question set for a date key ("YYYY-MM-DD"): balanced ops, 2–3 digits. */
export function dailyQuestions(key, n = DAILY_QUESTIONS) {
  const rng = mulberry32(hashString(`mathmind:${key}`));
  const ops = Array.from({ length: n }, (_, i) => OP_KEYS[i % OP_KEYS.length]);
  for (let i = ops.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ops[i], ops[j]] = [ops[j], ops[i]];
  }
  const seen = new Set();
  return ops.map((op) => {
    let q;
    do q = generate(op, 'd23', rng);
    while (seen.has(q.text));
    seen.add(q.text);
    return q;
  });
}

const range = (d) => [10 ** (d - 1), 10 ** d - 1];
const randInt = (min, max, rng) => min + Math.floor(rng() * (max - min + 1));
const digitCount = (n) => String(n).length;

/**
 * Build a question. Every question carries `tenths` (the answer × 10 as an
 * integer) so checking never depends on floating point.
 * Division answers are rounded half-up to 1 decimal.
 */
export function generate(op, level, rng = Math.random) {
  const pool = LEVELS[level].digits;
  const pick = () => pool[Math.floor(rng() * pool.length)];
  const num = (d) => randInt(...range(d), rng);
  let a;
  let b;
  let tenths;

  switch (op) {
    case 'add':
      a = num(pick());
      b = num(pick());
      tenths = (a + b) * 10;
      break;
    case 'sub':
      do {
        a = num(pick());
        b = num(pick());
      } while (a === b);
      if (a < b) [a, b] = [b, a]; // keep results positive
      tenths = (a - b) * 10;
      break;
    case 'mul': {
      const da = pick();
      let db = pick();
      if (da === 3 && db === 3) db = 2; // 3×3 digits is not a mental-math exercise
      a = num(da);
      b = num(db);
      tenths = a * b * 10;
      break;
    }
    case 'div': {
      const da = pick();
      const db = pick();
      let exact = false;
      if (rng() < 0.35) {
        // exact quotient (>= 2) so decimals aren't *always* required
        const [lo, hi] = range(da);
        b = num(db);
        const kMin = Math.max(2, Math.ceil(lo / b));
        const kMax = Math.floor(hi / b);
        if (kMin <= kMax) {
          a = b * randInt(kMin, kMax, rng);
          exact = true;
        }
      }
      if (!exact) {
        do {
          a = num(da);
          b = num(db);
        } while (a === b);
        if (a < b) [a, b] = [b, a];
      }
      tenths = Math.floor((20 * a + b) / (2 * b)); // round-half-up of 10a/b
      break;
    }
    default:
      throw new Error(`unknown op: ${op}`);
  }

  const par = (OPS[op].par * (digitCount(a) + digitCount(b))) / 4;
  return {
    op,
    a,
    b,
    sym: OPS[op].sym,
    text: `${a} ${OPS[op].sym} ${b}`,
    tenths,
    answerText: formatTenths(tenths, op === 'div'),
    par,
  };
}

export function formatTenths(tenths, forceDecimal = false) {
  const whole = Math.floor(tenths / 10);
  const frac = tenths % 10;
  return forceDecimal || frac ? `${whole}.${frac}` : String(whole);
}

/** Accepts "12", "12.", "12.3"; rejects empty, ".", or >1 decimal digit. */
export function parseInput(input) {
  if (!/^\d+(\.\d?)?$/.test(input)) return null;
  const [int, frac = ''] = input.split('.');
  return Number(int) * 10 + Number(frac || 0);
}

export function checkAnswer(question, input) {
  const tenths = parseInput(input);
  if (tenths === null) return { valid: false, correct: false };
  return { valid: true, correct: tenths === question.tenths };
}

/**
 * 100 base + up to 100 speed bonus (linear, zero at 2× par time),
 * multiplied by the streak: ×1.0 on the first correct answer, +0.1 each, capped at ×2.0.
 */
export function scoreAnswer(question, ms, streak) {
  const speed = Math.round(100 * Math.max(0, 1 - ms / 1000 / (2 * question.par)));
  const mult = 1 + 0.1 * Math.min(streak - 1, 10);
  return { base: 100, speed, mult, points: Math.round((100 + speed) * mult) };
}

/** Aggregate a session log: [{op, correct, ms, points}] in answer order. */
export function summarize(log) {
  const byOp = {};
  let streak = 0;
  let bestStreak = 0;
  let score = 0;
  let correct = 0;
  let correctMs = 0;
  let answerMs = 0;
  let fastestMs = null;

  for (const e of log) {
    const o = (byOp[e.op] ||= { n: 0, c: 0, ms: 0 });
    o.n++;
    answerMs += e.ms;
    if (e.correct) {
      o.c++;
      o.ms += e.ms;
      correct++;
      correctMs += e.ms;
      score += e.points;
      streak++;
      bestStreak = Math.max(bestStreak, streak);
      if (fastestMs === null || e.ms < fastestMs) fastestMs = e.ms;
    } else {
      streak = 0;
    }
  }
  return {
    total: log.length,
    correct,
    score,
    bestStreak,
    fastestMs,
    answerMs,
    avgMs: correct ? Math.round(correctMs / correct) : null,
    byOp,
  };
}
