// Pure lesson data and logic for the Learn tab: the catalog, the times-table rules, and the
// practice question sets. No DOM / storage access so it can be unit-tested under node.
import { makeQuestion, mulberry32 } from './engine.js';

export const LESSON_QUESTIONS = 6;
export const LESSON_BONUS_XP = 100; // first completed practice of each lesson

// `steps` is the number of visual steps (their captions live in i18n as `ln.<id>.steps`).
// Lessons without `steps` are listed as "coming soon"; `ex` is a language-neutral example.
export const CATALOG = [
  {
    group: 'start',
    items: [
      { id: 'table', op: 'mul', kind: 'remember', steps: 7, ex: '9 × 9 → 15' },
      { id: 'place', op: 'add', kind: 'rule', ex: '347 = 300 + 40 + 7' },
      { id: 'ten', op: 'add', kind: 'remember', ex: '3 + 7, 4 + 6, 8 + 2' },
    ],
  },
  {
    group: 'addsub',
    items: [
      { id: 'left', op: 'add', kind: 'rule', ex: '46 + 37 = 70 + 13' },
      { id: 'round', op: 'add', kind: 'rule', ex: '47 + 99 = 47 + 100 − 1' },
      { id: 'countup', op: 'sub', kind: 'rule', ex: '82 − 67: 67 → 70 → 82' },
      { id: 'shift', op: 'sub', kind: 'rule', ex: '73 − 28 = 75 − 30' },
    ],
  },
  {
    group: 'muldiv',
    items: [
      { id: 'split', op: 'mul', kind: 'rule', steps: 6, ex: '23 × 4 = 80 + 12' },
      { id: 'shortcuts', op: 'mul', kind: 'rule', ex: '36 × 5 = 360 ÷ 2' },
      { id: 'divback', op: 'div', kind: 'rule', ex: '56 ÷ 7 → ? × 7 = 56' },
      { id: 'decimals', op: 'div', kind: 'rule', ex: '17 ÷ 5 = 3 r2 = 3.4' },
    ],
  },
];
export const LESSONS = Object.fromEntries(CATALOG.flatMap((g) => g.items).map((l) => [l.id, l]));
export const READY = Object.values(LESSONS).filter((l) => l.steps).map((l) => l.id);

/* ---------------- the shrinking times table ---------------- */
// Rules apply in order; a cell belongs to the first rule that covers it (a = row, b = column).
// Rule n disappears at step n of the lesson. 0 = still to learn by heart.
const RULE_TESTS = [
  (a, b) => a === 1 || b === 1,
  (a, b) => a === 2 || b === 2,
  (a, b) => a === 5 || b === 5,
  (a, b) => a === 9 || b === 9,
  (a, b) => a < b, // order doesn't matter: only the lower triangle is left to learn
];
export const TABLE_RULES = RULE_TESTS.length;
export const tableRule = (a, b) => RULE_TESTS.findIndex((t) => t(a, b)) + 1;

/** Cells (a ≥ b) no rule covers: the facts to learn by heart. */
export function tableKeepers() {
  const out = [];
  for (let a = 1; a <= 9; a++) for (let b = 1; b <= 9; b++) if (!tableRule(a, b)) out.push([a, b]);
  return out;
}

/**
 * A keeper rebuilt from the ×2 and ×5 rules, as one language-neutral line
 * ("×2 ×2 ×2: 7 → 14 → 28 → 56", "5 × 7 + 7 = 35 + 7 = 42"), or null for 7 × 7.
 */
export function rebuild(a, b) {
  const p = a * b;
  const has = (k) => a === k || b === k;
  const other = (k) => (a === k ? b : a);
  if (has(8) || has(4)) {
    const k = has(8) ? 8 : 4;
    const n = other(k);
    const chain = [n];
    while (chain.at(-1) * 2 <= p) chain.push(chain.at(-1) * 2);
    return `${'×2 '.repeat(chain.length - 1).trim()}: ${chain.join(' → ')}`;
  }
  if (has(6) || has(3)) {
    const k = has(6) ? 6 : 3;
    const n = other(k);
    const base = k - 1; // 6 = 5 + 1, 3 = 2 + 1
    return `${base} × ${n} + ${n} = ${base * n} + ${n} = ${p}`;
  }
  return null;
}

/** How a cell is made: { rule, eq: [pieces], rebuild? }. The note text is i18n `ln.n<rule>`. */
export function tableExplain(a, b) {
  const rule = tableRule(a, b);
  const p = a * b;
  const other = (k) => (a === k ? b : a);
  const head = `${a} × ${b}`;
  switch (rule) {
    case 2: {
      const n = other(2);
      return { rule, eq: [head, `= ${n} + ${n}`, `= ${p}`] };
    }
    case 3: {
      const n = other(5);
      return { rule, eq: [head, `= ${n * 10} ÷ 2`, `= ${p}`] };
    }
    case 4: {
      const n = other(9);
      return { rule, eq: [head, `= ${n * 10} − ${n}`, `= ${p}`] };
    }
    case 5:
      return { rule, eq: [head, `= ${b} × ${a}`, `= ${p}`] };
    case 0:
      return { rule, eq: [head, `= ${p}`], rebuild: rebuild(a, b) };
    default:
      return { rule, eq: [head, `= ${p}`] };
  }
}

/* ---------------- practice sets ---------------- */
const shuffle = (arr, rng) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
const mul = (a, b, tip) => ({ ...makeQuestion('mul', a, b, a * b * 10), tip });

const PRACTICE = {
  // the 15 facts to learn by heart, each with its rebuild trick as the tip
  table: (rng) =>
    shuffle(tableKeepers(), rng)
      .slice(0, LESSON_QUESTIONS)
      .map(([a, b]) => {
        const [x, y] = rng() < 0.5 ? [a, b] : [b, a];
        return mul(x, y, rebuild(a, b) || `${x} × ${y} = ${x * y}`);
      }),
  // 2-digit × 1-digit with a non-zero ones digit, so the split always matters
  split: (rng) => {
    const seen = new Set();
    const out = [];
    while (out.length < LESSON_QUESTIONS) {
      const a = 12 + Math.floor(rng() * 87);
      const b = 3 + Math.floor(rng() * 7);
      const ones = a % 10;
      if (!ones || seen.has(a)) continue;
      seen.add(a);
      const tens = a - ones;
      out.push(mul(a, b, `${tens} × ${b} + ${ones} × ${b} = ${tens * b} + ${ones * b} = ${a * b}`));
    }
    return out;
  },
};

/** The practice questions for a lesson (game-ready, each with a language-neutral `tip`). */
export function lessonQuestions(id, rng = mulberry32((Math.random() * 2 ** 32) >>> 0)) {
  const make = PRACTICE[id];
  if (!make) throw new Error(`unknown lesson: ${id}`);
  return make(rng);
}
