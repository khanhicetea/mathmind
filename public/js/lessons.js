// Pure lesson data and logic for the Learn tab: the catalog, the times-table rules, and the
// practice question sets. No DOM / storage access so it can be unit-tested under node.
import { formatTenths, makeQuestion, mulberry32 } from './engine.js';

export const LESSON_QUESTIONS = 6;
export const LESSON_BONUS_XP = 100; // first completed practice of each lesson

// `steps` is the number of visual steps (their captions live in i18n as `ln.<id>.steps`).
// Lessons without `steps` are listed as "coming soon"; `ex` is a language-neutral example.
// `demo` lessons play through language-neutral equation lines; a step with `ask` is a 3-choice
// question [prompt, choices, right answer].
export const CATALOG = [
  {
    group: 'start',
    items: [
      { id: 'table', op: 'mul', kind: 'remember', steps: 7, ex: '9 × 9 → 15' },
      {
        id: 'place', op: 'add', kind: 'rule', ex: '347 = 300 + 40 + 7',
        demo: [
          ['347', '= 300 + 40 + 7'],
          ['300 = 3 × 100', '40 = 4 × 10', '7 = 7 × 1'],
          ['325 + 40', '= 300 + 60 + 5', '= 365'],
          ['508 = 500 + 0 + 8'],
          { ask: ['600 + 30 + 4 = ?', [634, 6304, 643], 634] },
        ],
      },
      {
        id: 'ten', op: 'add', kind: 'remember', ex: '3 + 7, 4 + 6, 8 + 2',
        demo: [
          ['1 + 9', '2 + 8', '3 + 7', '4 + 6', '5 + 5'],
          ['30 + 70 = 100', '60 + 40 = 100'],
          ['8 + 5', '= 8 + 2 + 3', '= 10 + 3', '= 13'],
          ['47 + 6', '= 47 + 3 + 3', '= 50 + 3', '= 53'],
          { ask: ['7 + 6 = 7 + 3 + ?', [2, 3, 4], 3] },
        ],
      },
    ],
  },
  {
    group: 'addsub',
    items: [
      {
        id: 'left', op: 'add', kind: 'rule', ex: '46 + 37 = 70 + 13',
        demo: [
          ['46 + 37', '= 40 + 6 + 30 + 7'],
          ['40 + 30 = 70'],
          ['6 + 7 = 13'],
          ['70 + 13 = 83'],
          { ask: ['58 + 25 = 70 + ?', [3, 13, 23], 13] },
        ],
      },
      {
        id: 'round', op: 'add', kind: 'rule', ex: '47 + 99 = 47 + 100 − 1',
        demo: [
          ['47 + 99', '99 = 100 − 1'],
          ['47 + 100 = 147'],
          ['147 − 1 = 146'],
          ['35 + 98', '= 35 + 100 − 2', '= 133'],
          { ask: ['64 + 49 = 64 + 50 − ?', [1, 9, 49], 1] },
        ],
      },
      {
        id: 'countup', op: 'sub', kind: 'rule', ex: '82 − 67: 67 → 70 → 82',
        demo: [
          ['82 − 67', '67 → ? → 82'],
          ['67 → 70', '+3'],
          ['70 → 82', '+12'],
          ['3 + 12 = 15', '82 − 67 = 15'],
          { ask: ['61 − 48: 48 → 50 → 61 = ?', [11, 13, 23], 13] },
        ],
      },
      {
        id: 'shift', op: 'sub', kind: 'rule', ex: '73 − 28 = 75 − 30',
        demo: [
          ['73 − 28'],
          ['73 + 2 = 75', '28 + 2 = 30'],
          ['75 − 30 = 45'],
          ['51 − 19', '= 52 − 20', '= 32'],
          { ask: ['84 − 39 = 85 − ?', [38, 39, 40], 40] },
        ],
      },
    ],
  },
  {
    group: 'muldiv',
    items: [
      { id: 'split', op: 'mul', kind: 'rule', steps: 6, ex: '23 × 4 = 80 + 12' },
      {
        id: 'shortcuts', op: 'mul', kind: 'rule', ex: '36 × 5 = 360 ÷ 2',
        demo: [
          ['36 × 5', '= 360 ÷ 2', '= 180'],
          ['24 × 9', '= 240 − 24', '= 216'],
          ['43 × 11', '= 430 + 43', '= 473'],
          ['43 × 11 → 4 (4+3) 3', '= 473'],
          { ask: ['62 × 5 = ?', [310, 312, 620], 310] },
        ],
      },
      {
        id: 'divback', op: 'div', kind: 'rule', ex: '56 ÷ 7 → ? × 7 = 56',
        demo: [
          ['56 ÷ 7 = ?'],
          ['? × 7 = 56', '8 × 7 = 56'],
          ['56 ÷ 7 = 8'],
          ['84 ÷ 4', '? × 4 = 84', '21 × 4 = 80 + 4', '84 ÷ 4 = 21'],
          { ask: ['72 ÷ 8 = ?', [7, 8, 9], 9] },
        ],
      },
      {
        id: 'decimals', op: 'div', kind: 'rule', ex: '17 ÷ 5 = 3 r2 = 3.4',
        demo: [
          ['17 ÷ 5', '= 3 r2'],
          ['2 ÷ 5', '= 20 ÷ 5 ÷ 10', '= 0.4'],
          ['17 ÷ 5', '= 3 + 0.4', '= 3.4'],
          ['13 ÷ 2', '= 6 r1', '= 6 + 0.5', '= 6.5'],
          { ask: ['9 ÷ 2 = ?', [4.1, 4.2, 4.5], 4.5] },
        ],
      },
    ],
  },
];
for (const l of CATALOG.flatMap((g) => g.items)) if (l.demo) l.steps = l.demo.length;
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
const add = (a, b, tip) => ({ ...makeQuestion('add', a, b, (a + b) * 10), tip });
const sub = (a, b, tip) => ({ ...makeQuestion('sub', a, b, (a - b) * 10), tip });
/** LESSON_QUESTIONS distinct questions from `make(i)` (which may return null to retry). */
const distinct = (rng, make) => {
  const out = new Map();
  while (out.size < LESSON_QUESTIONS) {
    const q = make(out.size);
    if (q && !out.has(q.text)) out.set(q.text, q);
  }
  return [...out.values()];
};

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
  // hundreds + ones, plus tens: just fill in the places
  place: (rng) =>
    distinct(rng, () => {
      const h = 1 + Math.floor(rng() * 9);
      const o = 1 + Math.floor(rng() * 9);
      const t = 1 + Math.floor(rng() * 9);
      const a = h * 100 + o;
      return add(a, t * 10, `${h * 100} + ${t * 10} + ${o} = ${a + t * 10}`);
    }),
  // 2-digit + 1-digit that crosses a ten: fill up to the ten first
  ten: (rng) =>
    distinct(rng, () => {
      const a = 11 + Math.floor(rng() * 88);
      const o = a % 10;
      const k = 10 - o;
      const b = k + 1 + Math.floor(rng() * (9 - k));
      if (!o || o === 1 || b > 9) return null;
      return add(a, b, `${a} + ${k} + ${b - k} = ${a + k} + ${b - k} = ${a + b}`);
    }),
  // 2-digit + 2-digit with a carry: tens, then ones
  left: (rng) =>
    distinct(rng, () => {
      const a = 12 + Math.floor(rng() * 70);
      const b = 12 + Math.floor(rng() * 70);
      if ((a % 10) + (b % 10) < 10 || a + b > 180) return null;
      const T = a - (a % 10) + b - (b % 10);
      return add(a, b, `${T} + ${(a % 10) + (b % 10)} = ${a + b}`);
    }),
  // + 99, + 48, ...: add the round number, then take the gap back
  round: (rng) =>
    distinct(rng, () => {
      const a = 21 + Math.floor(rng() * 260);
      const r = 10 * (2 + Math.floor(rng() * 9));
      const d = 1 + Math.floor(rng() * 2);
      return add(a, r - d, `${a} + ${r} − ${d} = ${a + r} − ${d} = ${a + r - d}`);
    }),
  // a gap that crosses a ten: hop to the ten, then on to the top
  countup: (rng) =>
    distinct(rng, () => {
      const a = 31 + Math.floor(rng() * 69);
      const b = 11 + Math.floor(rng() * (a - 20));
      if (!(b % 10) || b % 10 <= a % 10) return null;
      const up = b + 10 - (b % 10);
      return sub(a, b, `${b} → ${up} → ${a}: ${up - b} + ${a - up} = ${a - b}`);
    }),
  // take away a number ending in 7, 8 or 9: shift both up to a round one
  shift: (rng) =>
    distinct(rng, () => {
      const b = 10 * (1 + Math.floor(rng() * 6)) + 7 + Math.floor(rng() * 3);
      const a = b + 11 + Math.floor(rng() * 50);
      const k = 10 - (b % 10);
      if (a % 10 >= b % 10) return null;
      return sub(a, b, `${a + k} − ${b + k} = ${a - b}`);
    }),
  // ×5, ×9 and ×11, two of each
  shortcuts: (rng) =>
    distinct(rng, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const a = 2 * (6 + Math.floor(rng() * 44));
        return mul(a, 5, `${a * 10} ÷ 2 = ${a * 5}`);
      }
      if (kind === 1) {
        const a = 12 + Math.floor(rng() * 38);
        return mul(a, 9, `${a * 10} − ${a} = ${a * 9}`);
      }
      const a = 12 + Math.floor(rng() * 88);
      return mul(a, 11, `${a * 10} + ${a} = ${a * 11}`);
    }),
  // exact division: find the missing factor
  divback: (rng) =>
    distinct(rng, () => {
      const b = 3 + Math.floor(rng() * 7);
      const q = 3 + Math.floor(rng() * 10);
      return { ...makeQuestion('div', q * b, b, q * 10, true), tip: `${q} × ${b} = ${q * b} → ${q}` };
    }),
  // ÷2 and ÷5 with a remainder: the leftover becomes tenths
  decimals: (rng) =>
    distinct(rng, () => {
      const b = rng() < 0.5 ? 2 : 5;
      const a = 11 + Math.floor(rng() * 89);
      const r = a % b;
      if (!r) return null;
      const q = (a - r) / b;
      const tenths = (a * 10) / b;
      const ans = formatTenths(tenths, true);
      return { ...makeQuestion('div', a, b, tenths), tip: `${q} r${r} = ${q} + ${formatTenths((r * 10) / b, true)} = ${ans}` };
    }),
};

/** The practice questions for a lesson (game-ready, each with a language-neutral `tip`). */
export function lessonQuestions(id, rng = mulberry32((Math.random() * 2 ** 32) >>> 0)) {
  const make = PRACTICE[id];
  if (!make) throw new Error(`unknown lesson: ${id}`);
  return make(rng);
}
