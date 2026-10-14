import { OPS } from '../engine.js';
import { CATALOG, LESSONS, READY, TABLE_RULES, tableRule, tableExplain } from '../lessons.js';
import { t } from '../i18n.js';
import { state } from '../state.js';
import { $, lessonName, restartAnim } from '../util.js';
import { go } from '../nav.js';
import { startGame } from '../game.js';

const RULE_COLORS = ['--op-mul', '--muted', '--op-add', '--op-sub', '--op-div', '--teal']; // index = tableRule()
const doneLesson = (id) => !!state.lessons?.[id];

/* ---------------- Learn tab: the lesson list ---------------- */
export function renderLearn() {
  $('learn-count').textContent = t('learn_count', { d: READY.filter(doneLesson).length, n: READY.length });
  $('learn-list').innerHTML = CATALOG.map(
    (g) => `
    <section class="lgroup"><h2>${t(`lgroup.${g.group}`)}</h2>
      ${g.items
        .map((l) => {
          const ready = !!l.steps;
          const done = doneLesson(l.id);
          const st = ready ? (done ? `<span class="lstate done">✓ ${t('learn_done')}</span>` : `<span class="lstate go">${t('learn_start')}</span>`) : `<span class="lstate">${t('learn_soon')}</span>`;
          return `<button class="lesson ${ready ? '' : 'soon'}" data-op="${l.op}" ${ready ? `data-lesson="${l.id}"` : 'disabled'}>
            <span class="lsym" aria-hidden="true">${OPS[l.op].sym}</span>
            <span class="ltxt"><b>${lessonName(l.id)}</b><small>${l.ex}</small><span class="ktag ${l.kind}">${t(`kind.${l.kind}`)}</span></span>
            ${st}
          </button>`;
        })
        .join('')}
    </section>`,
  ).join('');
}

$('learn-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-lesson]');
  if (b) openLesson(b.dataset.lesson);
});

/* ---------------- lesson player ---------------- */
const STAGES = { table: tableStage, split: splitStage };
let lesson = null; // { id, step, stage }

export function openLesson(id) {
  const l = LESSONS[id];
  $('lsn-kind').textContent = `${t(`kind.${l.kind}`)} · ${OPS[l.op].sym}`;
  $('lsn-title').textContent = lessonName(id);
  $('lsn-steps').innerHTML = '<i></i>'.repeat(l.steps);
  lesson = { id, step: 0, stage: STAGES[id]($('lsn-stage')) };
  go('lesson');
  showStep(0, 1);
}

function showStep(i, dir) {
  const steps = t(`ln.${lesson.id}.steps`);
  lesson.step = i;
  const [h, p] = steps[i];
  $('lsn-h').textContent = h;
  $('lsn-p').textContent = p;
  restartAnim($('lsn-caption'), 'enter');
  [...$('lsn-steps').children].forEach((d, k) => d.classList.toggle('on', k <= i));
  $('lsn-prev').disabled = i === 0;
  $('lsn-next').textContent = i === steps.length - 1 ? t('learn_practice') : t('next');
  lesson.stage.show(i, dir);
}

$('lsn-back').addEventListener('click', () => go('learn'));
$('lsn-prev').addEventListener('click', () => lesson.step > 0 && showStep(lesson.step - 1, -1));
$('lsn-next').addEventListener('click', () => {
  if (lesson.step < LESSONS[lesson.id].steps - 1) showStep(lesson.step + 1, 1);
  else startGame('lesson', { lesson: lesson.id });
});

/* ---------------- stage: the shrinking times table ---------------- */
// Step n (1..5) wipes out the cells rule n covers; the last step highlights the 15 facts left.
const TABLE_EXAMPLES = [null, [7, 1], [8, 2], [7, 5], [7, 9], [3, 8], [8, 7]];

function tableStage(el) {
  let grid = '<span class="hd x">×</span>';
  for (let b = 1; b <= 9; b++) grid += `<span class="hd">${b}</span>`;
  for (let a = 1; a <= 9; a++) {
    grid += `<span class="hd">${a}</span>`;
    for (let b = 1; b <= 9; b++) {
      grid += `<button class="cell${a === b ? ' sq' : ''}" data-a="${a}" data-b="${b}" data-rule="${tableRule(a, b)}" aria-label="${a} × ${b}">${a * b}</button>`;
    }
  }
  el.innerHTML = `
    <div class="countline"><b class="count" id="tb-count">81</b> <span>${t('learn_facts_left')}</span></div>
    <div class="tgrid" id="tb-grid">${grid}</div>
    <div class="legend" id="tb-legend"></div>
    <div class="explain" id="tb-explain"></div>`;
  const cells = [...el.querySelectorAll('.cell')].map((c) => ({ el: c, a: +c.dataset.a, b: +c.dataset.b, r: +c.dataset.rule }));
  const covered = Array(TABLE_RULES + 1).fill(0);
  for (const c of cells) covered[c.r]++;
  let shown = 81;

  const countTo = (to) => {
    const out = $('tb-count');
    const from = shown;
    const t0 = performance.now();
    shown = to;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / 600);
      out.textContent = Math.round(from + (to - from) * k);
      if (k < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

  const explainCell = (a, b) => {
    for (const c of cells) c.el.classList.toggle('focus', c.a === a && c.b === b);
    const ex = tableExplain(a, b);
    const box = $('tb-explain');
    box.style.setProperty('--rc', `var(${RULE_COLORS[ex.rule]})`);
    const note = ex.rule ? t(`ln.n${ex.rule}`) : t(a === b ? 'ln.n0sq' : 'ln.n0');
    box.innerHTML = `<span class="note">${note}</span>
      <div class="eq">${ex.eq.map((s, k) => `<span style="--i:${k}">${s}</span>`).join('')}</div>
      ${ex.rebuild ? `<div class="rebuild"><small>${t('ln.rebuild')}</small> <span>${ex.rebuild}</span></div>` : ''}
      ${ex.rule ? '' : `<div class="dotgrid${a === b ? ' sq' : ''}" style="grid-template-columns:repeat(${b}, 11px)" aria-hidden="true">${Array.from({ length: a * b }, (_, k) => `<i style="--r:${Math.floor(k / b)}"></i>`).join('')}</div>`}`;
  };
  $('tb-grid').addEventListener('click', (e) => {
    const c = e.target.closest('.cell');
    if (c) explainCell(+c.dataset.a, +c.dataset.b);
  });

  return {
    show(i, dir) {
      let left = 0;
      let stagger = 0;
      for (const c of cells) {
        const gone = c.r > 0 && c.r <= i;
        if (!gone) left++;
        c.el.classList.toggle('gone', gone);
        c.el.classList.remove('zap');
        if (gone && c.r === i && dir > 0) {
          c.el.style.setProperty('--d', `${stagger++ * 35}ms`);
          restartAnim(c.el, 'zap');
        }
        c.el.classList.toggle('keep', i === TABLE_RULES + 1 && c.r === 0);
      }
      countTo(left);
      $('tb-legend').innerHTML = Array.from({ length: Math.min(i, TABLE_RULES) }, (_, k) =>
        `<span class="ktag" style="--rc:var(${RULE_COLORS[k + 1]})">${t(`ln.r${k + 1}`)} −${covered[k + 1]}</span>`).join('');
      if (i === 0) {
        for (const c of cells) c.el.classList.remove('focus');
        $('tb-explain').style.removeProperty('--rc');
        $('tb-explain').innerHTML = `<span class="note">${t('ln.tap')}</span><div class="eq"><span style="--i:0">9 × 9 = 81</span></div>`;
      } else explainCell(...TABLE_EXAMPLES[i]);
    },
  };
}

/* ---------------- stage: split it up (area model) ---------------- */
function splitStage(el) {
  el.innerHTML = `
    <div class="prob" id="sp-prob"></div>
    <div class="area" id="sp-area"></div>
    <div class="pieces" id="sp-pieces"></div>
    <div class="sumline" id="sp-sum"></div>
    <div class="slider" id="sp-slider" hidden>
      <input type="range" id="sp-cut" min="1" max="22" value="20" aria-label="${t('ln.cut_aria')}">
      <span class="tick" id="sp-tick"></span>
    </div>
    <div class="ask" id="sp-ask" hidden></div>`;
  const st = { a: 23, b: 4, split: 20, cut: false, parts: false, sum: false };
  let wasCut = false;

  const cellSize = (a) => Math.max(5, Math.min(16, Math.floor((el.clientWidth - 32 - 34 - 12) / a) - 2));
  const block = (cls, n, off) => `
    <div class="apart ${cls}"><span class="top">${n}</span>
      <div class="blk" style="grid-template-columns:repeat(${n}, var(--cs))">${Array.from({ length: n * st.b }, (_, k) => `<i style="--i:${off + (k % n)}"></i>`).join('')}</div></div>`;

  const draw = () => {
    const { a, b, split } = st;
    const r = a - split;
    $('sp-prob').innerHTML = `${a} <span class="x">×</span> ${b}`;
    const area = $('sp-area');
    area.style.setProperty('--cs', `${cellSize(a)}px`);
    area.innerHTML = `<div class="side">${b}</div><div class="parts"><span class="whole">${a}</span>${block('L', split, 0)}${r ? block('R', r, split) : ''}</div>`;
    if (st.cut && !wasCut) {
      area.classList.remove('cut');
      requestAnimationFrame(() => requestAnimationFrame(() => area.classList.add('cut')));
    } else area.classList.toggle('cut', st.cut);
    wasCut = st.cut;
    $('sp-pieces').innerHTML = st.parts
      ? `<span class="piece L">${split} × ${b} = ${split * b}</span>${r ? `<span class="piece R" style="animation-delay:.25s">${r} × ${b} = ${r * b}</span>` : ''}`
      : '';
    $('sp-sum').innerHTML = st.sum ? `<span>${split * b} + ${r * b} = <b>${a * b}</b></span>` : '';
  };

  $('sp-cut').addEventListener('input', (e) => {
    st.split = +e.target.value;
    const r = st.a - st.split;
    const best = st.split === st.a - (st.a % 10);
    $('sp-tick').textContent = t(best ? 'ln.cut_best' : 'ln.cut_other', { x: st.split * st.b, y: r * st.b, p: st.a * st.b });
    $('sp-tick').classList.toggle('best', best);
    draw();
  });
  addEventListener('resize', () => !el.closest('[hidden]') && draw());

  // the guided 34 × 6: choose the cut, then solve each part
  const guided = () => {
    const ask = $('sp-ask');
    const choose = (q, opts, right, onRight, wrongMsg) => {
      ask.innerHTML = `<div class="q">${q}</div><div class="choices">${opts.map((o) => `<button class="choice" data-v="${o}">${o}</button>`).join('')}</div><div class="msg" aria-live="polite"></div>`;
      ask.querySelector('.choices').onclick = (e) => {
        const btn = e.target.closest('.choice');
        if (!btn) return;
        const msg = ask.querySelector('.msg');
        if (btn.dataset.v === String(right)) {
          btn.classList.add('right');
          setTimeout(onRight, 550);
        } else {
          restartAnim(btn, 'wrong');
          msg.className = 'msg bad';
          msg.textContent = wrongMsg;
        }
      };
    };
    const solveTens = () =>
      choose('30 × 6 = ?', [18, 180, 360], 180, () => { st.parts = true; draw(); solveOnes(); }, t('ln.h_tens', { t: 3, b: 6, p: 18, P: 180 }));
    const solveOnes = () => choose('4 × 6 = ?', [20, 28, 24], 24, addUp, t('ln.h_fact', { o: 4, b: 6, p: 24 }));
    const addUp = () =>
      choose('180 + 24 = ?', [194, 204, 214], 204, () => {
        st.sum = true;
        draw();
        ask.innerHTML = `<div class="msg ok">${t('ln.guided_done', { a: 34, b: 6, p: 204 })}</div>`;
      }, '180 + 20 = 200 → 204');
    // the cut question: any split is "right", but only the tens cut moves on
    ask.innerHTML = `<div class="q">${t('ln.where', { n: 34 })}</div>
      <div class="choices">${[17, 20, 30].map((s) => `<button class="choice" data-s="${s}">${s} + ${34 - s}</button>`).join('')}</div>
      <div class="msg" aria-live="polite"></div>`;
    ask.querySelector('.choices').onclick = (e) => {
      const btn = e.target.closest('.choice');
      if (!btn) return;
      st.split = +btn.dataset.s;
      st.cut = true;
      wasCut = false;
      draw();
      const msg = ask.querySelector('.msg');
      if (st.split === 30) {
        btn.classList.add('right');
        msg.className = 'msg ok';
        msg.textContent = t('ln.tens_ok');
        setTimeout(solveTens, 900);
      } else {
        msg.className = 'msg bad';
        msg.textContent = t('ln.harder', { p: 34 - st.split, b: 6 });
      }
    };
  };

  return {
    show(i) {
      $('sp-slider').hidden = i !== 4;
      $('sp-ask').hidden = i !== 5;
      if (i === 5) Object.assign(st, { a: 34, b: 6, split: 30, cut: false, parts: false, sum: false });
      else Object.assign(st, { a: 23, b: 4, split: 20, cut: i >= 1, parts: i >= 2, sum: i >= 3 });
      wasCut = i !== 1 && st.cut; // the cut animates open only when step 1 is reached
      if (i === 4) {
        $('sp-cut').value = 20;
        $('sp-cut').dispatchEvent(new Event('input'));
      } else draw();
      if (i === 5) guided();
    },
  };
}
