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
      {
        id: 'complement', op: 'sub', kind: 'remember', ex: '1000 − 284 = 716',
        demo: [
          ['100 − 37', '3 + 6 = 9', '7 + 3 = 10', '= 63'],
          ['37 + 63 = 100'],
          ['1000 − 284', '2 + 7 = 9', '8 + 1 = 9', '4 + 6 = 10', '= 716'],
          ['400 − 137', '137 → 200: 63', '200 → 400: 200', '= 263'],
          { ask: ['100 − 46 = ?', [54, 64, 56], 54] },
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
        id: 'hundreds', op: 'add', kind: 'rule', ex: '347 + 285 = 500 + 120 + 12',
        demo: [
          ['347 + 285', '= 300 + 40 + 7', '+ 200 + 80 + 5'],
          ['300 + 200 = 500'],
          ['40 + 80 = 120', '7 + 5 = 12'],
          ['500 + 120 + 12', '= 632'],
          { ask: ['256 + 371 = 500 + 120 + ?', [7, 17, 27], 7] },
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
    group: 'mul',
    items: [
      { id: 'split', op: 'mul', kind: 'rule', steps: 6, ex: '23 × 4 = 80 + 12' },
      {
        id: 'zeros', op: 'mul', kind: 'rule', ex: '30 × 40 = 1200',
        demo: [
          ['30 × 40', '3 × 4 = 12'],
          ['30 × 40', '= 12 + 00', '= 1200'],
          ['60 × 7', '6 × 7 = 42', '= 420'],
          ['50 × 80', '5 × 8 = 40', '= 4000'],
          { ask: ['70 × 30 = ?', [210, 2100, 21000], 2100] },
        ],
      },
      {
        id: 'twobytwo', op: 'mul', kind: 'rule', ex: '47 × 38 = 1410 + 376',
        demo: [
          ['47 × 38', '= 47 × 30 + 47 × 8'],
          ['47 × 30', '= 47 × 3 × 10', '= 1410'],
          ['47 × 8', '= 320 + 56', '= 376'],
          ['1410 + 376', '= 1786'],
          ['386 × 47', '= 386 × 40 + 386 × 7', '= 15440 + 2702', '= 18142'],
          { ask: ['24 × 13 = 240 + ?', [62, 72, 82], 72] },
        ],
      },
      {
        id: 'roundmul', op: 'mul', kind: 'rule', ex: '49 × 7 = 350 − 7',
        demo: [
          ['49 × 7', '49 = 50 − 1'],
          ['50 × 7 = 350'],
          ['350 − 7 = 343'],
          ['98 × 23', '= 100 × 23 − 2 × 23', '= 2300 − 46', '= 2254'],
          { ask: ['29 × 6 = 180 − ?', [1, 6, 12], 6] },
        ],
      },
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
        id: 'halvedouble', op: 'mul', kind: 'rule', ex: '25 × 16 = 50 × 8 = 400',
        demo: [
          ['25 × 16', '= 50 × 8', '= 100 × 4', '= 400'],
          ['14 × 35', '= 7 × 70', '= 490'],
          ['48 × 25', '= 4800 ÷ 4', '= 1200'],
          ['86 × 50', '= 8600 ÷ 2', '= 4300'],
          { ask: ['18 × 15 = 9 × ?', [15, 30, 45], 30] },
        ],
      },
      {
        id: 'squares', op: 'mul', kind: 'rule', ex: '48 × 52 = 2500 − 4',
        demo: [
          ['35 × 35', '3 × 4 = 12', '5 × 5 = 25', '= 1225'],
          ['65 × 65', '6 × 7 = 42', '= 4225'],
          ['48 × 52', '= 50 × 50 − 2 × 2', '= 2500 − 4', '= 2496'],
          ['37 × 43', '= 40 × 40 − 3 × 3', '= 1600 − 9', '= 1591'],
          { ask: ['45 × 45 = ?', [1625, 2025, 2045], 2025] },
        ],
      },
    ],
  },
  {
    group: 'div',
    items: [
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
        id: 'splitdiv', op: 'div', kind: 'rule', ex: '156 ÷ 6 = 20 + 6',
        demo: [
          ['156 ÷ 6', '156 = 120 + 36'],
          ['120 ÷ 6 = 20'],
          ['36 ÷ 6 = 6'],
          ['20 + 6 = 26', '156 ÷ 6 = 26'],
          { ask: ['168 ÷ 7 = 140 ÷ 7 + ?', [3, 4, 28], 4] },
        ],
      },
      {
        id: 'halvediv', op: 'div', kind: 'rule', ex: '136 ÷ 4 → 68 → 34',
        demo: [
          ['136 ÷ 4', '136 ÷ 2 = 68', '68 ÷ 2 = 34'],
          ['248 ÷ 8', '→ 124 → 62 → 31'],
          ['87 ÷ 5', '= 174 ÷ 10', '= 17.4'],
          ['340 ÷ 25', '= 1360 ÷ 100', '= 13.6'],
          { ask: ['92 ÷ 4 = ?', [23, 24, 46], 23] },
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
      {
        id: 'roundtenth', op: 'div', kind: 'rule', ex: '23 ÷ 7 = 3 r2 ≈ 3.3',
        demo: [
          ['23 ÷ 7', '= 3 r2'],
          ['2 = 20 tenths', '20 ÷ 7 = 2 r6', '→ 3.2…'],
          ['7 ÷ 2 = 3.5', '6 > 3.5 → round up'],
          ['23 ÷ 7 ≈ 3.3'],
          ['19 ÷ 6', '= 3 r1', '10 ÷ 6 = 1 r4', '4 ≥ 3 → 3.2'],
          { ask: ['10 ÷ 3 ≈ ?', [3.1, 3.3, 3.4], 3.3] },
        ],
      },
      {
        id: 'remtable', op: 'div', kind: 'remember', ex: '÷8: r1 → .1, r3 → .4',
        demo: [
          ['÷ 3', 'r1 → 0.3', 'r2 → 0.7'],
          ['÷ 6', 'r1 → 0.2', 'r2 → 0.3', 'r3 → 0.5', 'r4 → 0.7', 'r5 → 0.8'],
          ['÷ 8', 'r1 → 0.1', 'r2 → 0.3', 'r3 → 0.4', 'r4 → 0.5', 'r5 → 0.6', 'r6 → 0.8', 'r7 → 0.9'],
          ['÷ 7', 'r1 → 0.1', 'r2 → 0.3', 'r3 → 0.4', 'r4 → 0.6', 'r5 → 0.7', 'r6 → 0.9'],
          ['÷ 9', 'r1 … r4 → 0.1 … 0.4', 'r5 … r8 → 0.6 … 0.9'],
          ['50 ÷ 8', '= 6 r2', 'r2 → 0.3', '≈ 6.3'],
          { ask: ['29 ÷ 7 = 4 r1 ≈ ?', [4.1, 4.2, 4.7], 4.1] },
        ],
      },
      {
        id: 'bigdiv', op: 'div', kind: 'rule', ex: '743 ÷ 37 → 37 × 20 = 740',
        demo: [
          ['743 ÷ 37', '37 × 20 = 740'],
          ['743 − 740 = 3', '= 20 r3'],
          ['3 ÷ 37 ≈ 0.08', '→ 0.1'],
          ['743 ÷ 37 ≈ 20.1'],
          ['612 ÷ 29', '29 × 20 = 580', '612 − 580 = 32', '32 = 29 + 3', '= 21 r3 ≈ 21.1'],
          { ask: ['483 ÷ 24 ≈ ?', [2.1, 20.1, 21.1], 20.1] },
        ],
      },
    ],
  },
  {
    group: 'check',
    items: [
      {
        id: 'estimate', op: 'mul', kind: 'rule', ex: '47 × 38 ≈ 50 × 40 = 2000',
        demo: [
          ['47 × 38', '≈ 50 × 40', '= 2000'],
          ['47 × 38', '7 × 8 = 56', '→ …6'],
          ['47 × 38 = 1786?', '≈ 2000 ✓', '…6 ✓'],
          ['47 × 38 = 2786?', '≈ 2000 ✗'],
          { ask: ['63 × 29 = …?', [3, 7, 9], 7] },
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
  // 100 − x and 1000 − xyz: each digit up to 9, the last one up to 10
  complement: (rng) =>
    distinct(rng, (i) => {
      const top = i % 2 ? 1000 : 100;
      const b = 11 + Math.floor(rng() * (top - 12));
      if (!(b % 10)) return null;
      return sub(top, b, `${b} + ${top - b} = ${top} → ${top - b}`);
    }),
  // 3-digit + 3-digit: hundreds, tens, ones, then the three parts
  hundreds: (rng) =>
    distinct(rng, () => {
      const a = 101 + Math.floor(rng() * 499);
      const b = 101 + Math.floor(rng() * 399);
      if (!(a % 10) || !(b % 10)) return null;
      const H = a - (a % 100) + b - (b % 100);
      const T = (a % 100) - (a % 10) + (b % 100) - (b % 10);
      return add(a, b, `${H} + ${T} + ${(a % 10) + (b % 10)} = ${a + b}`);
    }),
  // tens × tens (or × a digit): multiply the digits, then put the zeros back
  zeros: (rng) =>
    distinct(rng, (i) => {
      const d = 2 + Math.floor(rng() * 8);
      const e = 3 + Math.floor(rng() * 7);
      const [a, b] = i % 3 === 0 ? [d * 10, e] : i % 3 === 1 ? [d * 10, e * 10] : [d * 100, e];
      return mul(a, b, `${d} × ${e} = ${d * e} → ${a * b}`);
    }),
  // 2-digit × 2-digit: split the second factor at the tens
  twobytwo: (rng) =>
    distinct(rng, () => {
      const a = 13 + Math.floor(rng() * 86);
      const b = 12 + Math.floor(rng() * 38);
      const o = b % 10;
      if (!o || !(a % 10) || a === b) return null;
      const T = b - o;
      return mul(a, b, `${a} × ${T} + ${a} × ${o} = ${a * T} + ${a * o} = ${a * b}`);
    }),
  // a factor just under a round number: multiply the round number, take the extra back
  roundmul: (rng) =>
    distinct(rng, () => {
      const r = 10 * (2 + Math.floor(rng() * 9));
      const d = 1 + Math.floor(rng() * 2);
      const b = r === 100 ? 11 + Math.floor(rng() * 15) : 3 + Math.floor(rng() * 7);
      return mul(r - d, b, `${r} × ${b} − ${d} × ${b} = ${r * b} − ${d * b} = ${(r - d) * b}`);
    }),
  // ×25, ×50, and halve-one-double-the-other
  halvedouble: (rng) =>
    distinct(rng, (i) => {
      const kind = i % 3;
      if (kind === 0) {
        const a = 4 * (3 + Math.floor(rng() * 22));
        return mul(a, 25, `${a * 100} ÷ 4 = ${a * 25}`);
      }
      if (kind === 1) {
        const a = 2 * (6 + Math.floor(rng() * 44));
        return mul(a, 50, `${a * 100} ÷ 2 = ${a * 50}`);
      }
      const a = 2 * (6 + Math.floor(rng() * 19));
      const b = [15, 35, 45][Math.floor(rng() * 3)];
      return mul(a, b, `${a / 2} × ${b * 2} = ${a * b}`);
    }),
  // squares ending in 5, and pairs either side of a round number
  squares: (rng) =>
    distinct(rng, (i) => {
      if (i % 2) {
        const t = 1 + Math.floor(rng() * 9);
        const n = 10 * t + 5;
        return mul(n, n, `${t} × ${t + 1} = ${t * (t + 1)} → ${n * n}`);
      }
      const m = 10 * (2 + Math.floor(rng() * 8));
      const d = 1 + Math.floor(rng() * 4);
      return mul(m - d, m + d, `${m * m} − ${d * d} = ${m * m - d * d}`);
    }),
  // 3-digit ÷ 1-digit, exact: split off the tens part the divisor goes into
  splitdiv: (rng) =>
    distinct(rng, () => {
      const b = 3 + Math.floor(rng() * 7);
      const q = 12 + Math.floor(rng() * 28);
      if (!(q % 10) || q * b < 100) return null;
      const big = b * (q - (q % 10));
      const rest = q * b - big;
      return { ...makeQuestion('div', q * b, b, q * 10, true), tip: `${big} ÷ ${b} + ${rest} ÷ ${b} = ${big / b} + ${rest / b} = ${q}` };
    }),
  // ÷4 and ÷8 by halving (exact), ÷5 by doubling then ÷10
  halvediv: (rng) =>
    distinct(rng, (i) => {
      const kind = i % 3;
      if (kind === 2) {
        const a = 21 + Math.floor(rng() * 179);
        if (!(a % 5)) return null;
        const ans = formatTenths(a * 2, true);
        return { ...makeQuestion('div', a, 5, a * 2), tip: `${a * 2} ÷ 10 = ${ans}` };
      }
      const k = kind ? 8 : 4;
      const q = 11 + Math.floor(rng() * (kind ? 30 : 50));
      const chain = [q * k];
      while (chain.at(-1) > q) chain.push(chain.at(-1) / 2);
      return { ...makeQuestion('div', q * k, k, q * 10, true), tip: chain.join(' → ') };
    }),
  // ÷3, 6, 7, 8, 9 with a leftover: tenths from the leftover, round the rest
  roundtenth: (rng) =>
    distinct(rng, () => {
      const b = [3, 6, 7, 8, 9][Math.floor(rng() * 5)];
      const a = 11 + Math.floor(rng() * 89);
      const r = a % b;
      if (!r) return null;
      const q = (a - r) / b;
      const tenths = Math.floor((20 * a + b) / (2 * b));
      const t1 = Math.floor((r * 10) / b);
      return {
        ...makeQuestion('div', a, b, tenths),
        tip: `${q} r${r} → ${r * 10} ÷ ${b} = ${t1} r${(r * 10) % b} → ${formatTenths(tenths, true)}`,
      };
    }),
  // the same divisions, read straight off the leftover table
  remtable: (rng) =>
    distinct(rng, () => {
      const b = [3, 6, 7, 8, 9][Math.floor(rng() * 5)];
      const a = 11 + Math.floor(rng() * 89);
      const r = a % b;
      if (!r) return null;
      const q = (a - r) / b;
      const tenths = Math.floor((20 * a + b) / (2 * b));
      const rt = Math.floor((20 * r + b) / (2 * b));
      return { ...makeQuestion('div', a, b, tenths), tip: `${q} r${r}, r${r} → 0.${rt} → ${formatTenths(tenths, true)}` };
    }),
  // 3-digit ÷ 2-digit: a round multiple of the divisor, then the leftover
  bigdiv: (rng) =>
    distinct(rng, () => {
      const b = 12 + Math.floor(rng() * 38);
      const q = 10 * (1 + Math.floor(rng() * 3));
      const r = 1 + Math.floor(rng() * (b - 1));
      const a = b * q + r;
      if (a > 999) return null;
      const tenths = Math.floor((20 * a + b) / (2 * b));
      return {
        ...makeQuestion('div', a, b, tenths),
        tip: `${b} × ${q} = ${b * q}, r${r} → ${formatTenths(tenths, true)}`,
      };
    }),
  // 2-digit × 2-digit, checked by rounding and by the last digit
  estimate: (rng) =>
    distinct(rng, () => {
      const a = 13 + Math.floor(rng() * 86);
      const b = 13 + Math.floor(rng() * 86);
      if (!(a % 10) || !(b % 10) || a === b) return null;
      const ra = Math.round(a / 10) * 10;
      const rb = Math.round(b / 10) * 10;
      const p = a * b;
      return mul(a, b, `≈ ${ra} × ${rb} = ${ra * rb}, ${a % 10} × ${b % 10} → …${p % 10}: ${p}`);
    }),
};

/** The practice questions for a lesson (game-ready, each with a language-neutral `tip`). */
export function lessonQuestions(id, rng = mulberry32((Math.random() * 2 ** 32) >>> 0)) {
  const make = PRACTICE[id];
  if (!make) throw new Error(`unknown lesson: ${id}`);
  return make(rng);
}
