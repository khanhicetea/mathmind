import {
  OPS,
  OP_KEYS,
  LEVELS,
  MODES,
  SPRINT_SECONDS,
  DAILY_QUESTIONS,
  RESULT_PAUSE_MS,
  generate,
  dailyQuestions,
  checkAnswer,
  scoreAnswer,
  summarize,
} from './engine.js';
import {
  GOAL_OPTIONS,
  ACHIEVEMENTS,
  dayKey,
  addDays,
  keyToDate,
  dayStreak,
  heatmap,
  levelInfo,
  applySession,
  achievementContext,
  skillStats,
  scoreKey,
} from './progress.js';
import * as store from './store.js';
import * as fx from './fx.js';
import { LANGS, t, setLang, getLang, translateDom } from './i18n.js';

const $ = (id) => document.getElementById(id);
let state = store.load();
fx.configure(state.settings);
setLang(state.settings.lang);
$('pad').classList.toggle('phone', !!state.settings.phonePad);
const MAX_INPUT_LEN = 7;
const COMBO_EVERY = 5;
const RING_C = 2 * Math.PI * 27;

/* ---------------- helpers ---------------- */
const secs = (ms) => (ms / 1000).toFixed(1) + 's';
const pct = (n, d) => (d ? Math.min(100, Math.round((100 / d) * n)) : 0);
const fmt = (n) => Number(n || 0).toLocaleString(getLang());
const fmtDate = (ts) =>
  new Intl.DateTimeFormat(getLang(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ts);
const fmtDay = (ts) => new Intl.DateTimeFormat(getLang(), { month: 'short', day: 'numeric', year: 'numeric' }).format(ts);
const fmtDur = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};
const sprintLabel = (sec) => (sec % 60 ? `${sec}s` : t('min', { n: sec / 60 }));
const opName = (k) => t(`op.${k}`);
const modeName = (m) => t(`mode.${m}`);
const titleName = (title) => t(`title.${title}`);
const achText = (a) => t(`ach.${a.id}`).map((x) => x.replace(/\{q\}/g, DAILY_QUESTIONS));
const modeLabel = (s) =>
  (MODES[s.mode] ? modeName(s.mode) : '') + (s.mode === 'sprint' ? ` ${sprintLabel(s.sprintSec || 60)}` : '');
const stat = (label, value) => `<div class="stat"><small>${label}</small><b>${value}</b></div>`;
const restartAnim = (el, cls) => {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
};

/* ---------------- navigation ---------------- */
// Mascot: CSS animates each pose (see .mascot in style.css); re-setting a pose replays its motion.
const homeMascot = $('home-mascot');
const playMascot = $('play-mascot');
function pose(el, name) {
  if (el.dataset.pose === name) {
    el.removeAttribute('data-pose');
    void el.offsetWidth;
  }
  el.dataset.pose = name;
}
function wave() {
  pose(homeMascot, 'hello');
}
homeMascot.addEventListener('animationend', (e) => {
  if (e.animationName === 'm-wave') pose(homeMascot, 'idle');
});
homeMascot.addEventListener('click', wave);

const TABS = ['home', 'progress', 'awards', 'settings'];
const RENDER = { home: renderHome, progress: renderProgress, awards: renderAwards, settings: renderSettings };

function go(name) {
  RENDER[name]?.();
  for (const v of document.querySelectorAll('.view')) v.hidden = v.id !== `view-${name}`;
  $('tabbar').hidden = !TABS.includes(name);
  for (const b of $('tabbar').children) b.setAttribute('aria-current', b.dataset.tab === name ? 'page' : 'false');
  window.scrollTo(0, 0);
  if (name === 'home') wave();
}
$('tabbar').addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]');
  if (b) go(b.dataset.tab);
});
$('lvl-chip').addEventListener('click', () => go('awards'));

/* ---------------- home ---------------- */
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return t('greet.late');
  if (h < 12) return t('greet.morning');
  if (h < 18) return t('greet.afternoon');
  return t('greet.evening');
}

function renderHome() {
  const today = dayKey();
  const goal = state.settings.goal;
  const day = state.days[today] || { correct: 0, met: false };
  const streak = dayStreak(state.days, today);
  const lv = levelInfo(state.xp);

  const name = state.settings.name;
  $('greet').textContent = name ? t('greet.hi', { name }) : greeting();
  const avatar = state.settings.avatar;
  $('home-avatar').hidden = !avatar;
  homeMascot.hidden = !!avatar;
  if (avatar) $('home-avatar').src = avatar;
  $('lvl-chip').innerHTML = `<b>${lv.level}</b><span>${titleName(lv.title)}</span>`;

  // streak + goal ring
  $('daily-card').classList.toggle('lit', !!day.met);
  $('streak-num').textContent = streak;
  $('goal-num').textContent = day.correct;
  $('goal-of').textContent = `/ ${goal}`;
  $('goal-ring').setAttribute('aria-label', t('goal_aria', { c: day.correct, g: goal }));
  const ring = $('goal-ring-fg');
  ring.style.strokeDasharray = RING_C;
  ring.style.strokeDashoffset = RING_C * (1 - Math.min(1, day.correct / goal));

  $('week').innerHTML = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6))
    .map((k) => {
      const d = state.days[k];
      const cls = d?.met ? 'met' : d?.correct ? 'part' : '';
      const label = keyToDate(k).toLocaleDateString(getLang(), { weekday: 'narrow' });
      return `<div class="wd ${cls} ${k === today ? 'today' : ''}"><span class="dot">${d?.met ? '✓' : ''}</span><small>${label}</small></div>`;
    })
    .join('');

  const left = goal - day.correct;
  $('daily-msg').textContent = day.met
    ? t('msg_done', { s: streak })
    : t(streak ? 'msg_keep' : 'msg_start', { n: left, s: streak });

  // level
  $('xp-level').textContent = t('level_title', { l: lv.level, t: titleName(lv.title) });
  $('xp-num').textContent = `${fmt(lv.into)} / ${fmt(lv.need)} XP`;
  $('xp-fill').style.width = pct(lv.into, lv.need) + '%';

  // modes
  const daily = state.daily[today];
  $('mode-daily-sub').textContent = daily
    ? t('daily_done', { c: daily.correct, q: DAILY_QUESTIONS, p: fmt(daily.score) })
    : t('daily_new', { q: DAILY_QUESTIONS });
  $('mode-daily-badge').textContent = daily ? '✓' : t('badge_new');
  $('mode-daily-badge').classList.toggle('done', !!daily);
  renderSprintMode();
  $('mode-endless-sub').textContent = state.records.combo
    ? t('endless_best', { n: state.records.combo })
    : t('endless_sub');

  // practice set
  $('op-chips').innerHTML = OP_KEYS.map((k) => {
    const on = state.settings.ops.includes(k);
    return `<button class="chip" data-op="${k}" aria-pressed="${on}"><b>${OPS[k].sym}</b><span>${opName(k)}</span></button>`;
  }).join('');
  $('level-seg').innerHTML = Object.entries(LEVELS)
    .map(
      ([k, l]) =>
        `<label><input type="radio" name="level" value="${k}" ${state.settings.level === k ? 'checked' : ''}><span>${t(`lv.${k}`)}</span></label>`,
    )
    .join('');

  // app icon badge (installed PWA): a nudge while today's goal is open
  try {
    (day.met ? navigator.clearAppBadge?.() : navigator.setAppBadge?.(1))?.catch(() => {});
  } catch {
    /* unsupported */
  }
}

function renderSprintMode() {
  const sprintSec = state.settings.sprintSec;
  const best = state.records.score[scoreKey({ mode: 'sprint', sprintSec })];
  const pill = $('sprint-len');
  pill.innerHTML = `${sprintLabel(sprintSec)} <span aria-hidden="true">⇄</span>`;
  pill.setAttribute('aria-label', t('sprint_aria', { len: sprintLabel(sprintSec) }));
  $('mode-sprint-sub').textContent = best ? t('sprint_best', { p: fmt(best) }) : t('sprint_sub', { len: sprintLabel(sprintSec) });
}

for (const el of [$('modes'), $('practice-modes')]) {
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mode]');
    if (b) startGame(b.dataset.mode);
  });
}
$('op-chips').addEventListener('click', (e) => {
  const chip = e.target.closest('.chip');
  if (!chip) return;
  const op = chip.dataset.op;
  const ops = state.settings.ops;
  if (ops.includes(op)) {
    if (ops.length === 1) return fx.toast(t('keep_one_op'));
    state.settings.ops = ops.filter((o) => o !== op);
  } else {
    state.settings.ops = OP_KEYS.filter((o) => ops.includes(o) || o === op);
  }
  chip.setAttribute('aria-pressed', state.settings.ops.includes(op));
  store.save(state);
});
$('level-seg').addEventListener('change', (e) => {
  state.settings.level = e.target.value;
  store.save(state);
});
$('sprint-len').addEventListener('click', () => {
  const i = SPRINT_SECONDS.indexOf(state.settings.sprintSec);
  state.settings.sprintSec = SPRINT_SECONDS[(i + 1) % SPRINT_SECONDS.length];
  store.save(state);
  renderSprintMode();
  fx.haptic(10);
});

/* ---------------- progress ---------------- */
function renderProgress() {
  const r = state.records;
  const ctx = achievementContext(state);
  const totals = OP_KEYS.reduce((t, k) => t + (state.ops[k]?.n || 0), 0);
  $('prog-bests').innerHTML =
    stat(t('st.day_streak'), `🔥 ${dayStreak(state.days)}`) +
    stat(t('st.longest'), t('days', { n: r.bestDayStreak })) +
    SPRINT_SECONDS.map((sec) => stat(t('st.sprint_best', { len: sprintLabel(sec) }), fmt(r.score[`sprint${sec}`]))).join('') +
    stat(t('st.daily_best'), fmt(r.score.daily)) +
    stat(t('st.best_combo'), `⚡ ${r.combo}`) +
    stat(t('st.best_avg'), r.avgMs != null ? secs(r.avgMs) : '–') +
    stat(t('st.correct_answers'), fmt(ctx.correct)) +
    stat(t('st.accuracy'), totals ? `${pct(ctx.correct, totals)}%` : '–');

  const cells = heatmap(state.days, state.settings.goal);
  const active = cells.filter((c) => c.correct).length;
  $('heat-note').textContent = active
    ? t('heat_active', { a: active, d: cells.filter((c) => !c.future).length })
    : t('heat_empty');
  // Monday-first narrow weekday letters; only alternate rows are labelled
  $('heat-days').innerHTML = Array.from({ length: 7 }, (_, i) =>
    `<span>${i % 2 || i === 6 ? '' : new Date(2024, 0, 1 + i).toLocaleDateString(getLang(), { weekday: 'narrow' })}</span>`,
  ).join('');
  $('heat').innerHTML = cells
    .map(
      (c) =>
        `<i class="h${c.level}${c.future ? ' fut' : ''}${c.today ? ' today' : ''}" title="${t('heat_cell', { date: fmtDay(keyToDate(c.key)), n: c.correct })}"></i>`,
    )
    .join('');

  const sk = skillStats(state);
  $('skills').innerHTML = OP_KEYS.map((k) => {
    const s = sk.ops[k];
    const weak = sk.weakest === k;
    return `<div class="skill ${weak ? 'weak' : ''}" data-op="${k}">
      <b class="sym">${OPS[k].sym}</b>
      <div>
        <div class="skill-head">${opName(k)}${weak ? `<span class="tag">${t('focus')}</span>` : ''}</div>
        <div class="bar"><i style="width:${Math.round(s.acc * 100)}%"></i></div>
        <small>${s.n ? t('skill_line', { acc: Math.round(s.acc * 100), avg: s.avgMs != null ? secs(s.avgMs) : '–', n: fmt(s.n) }) : t('not_practiced')}</small>
      </div>
      <button class="btn small" data-focus="${k}" aria-label="${t('practice_aria', { op: opName(k) })}">${t('practice')}</button>
    </div>`;
  }).join('');

  const recent = state.history.slice(0, 60);
  $('hist-empty').hidden = recent.length > 0;
  $('hist-list').innerHTML = recent
    .map(
      (s) => `<details class="sess">
        <summary>
          <span class="s-icon" aria-hidden="true">${MODES[s.mode]?.icon ?? '♾️'}</span>
          <span class="when">${fmtDate(s.ts)}</span>
          <span class="meta">${s.correct}/${s.total} (${pct(s.correct, s.total)}%) · ${t('avg', { t: s.avgMs != null ? secs(s.avgMs) : '–' })} · ⚡${s.bestStreak}</span>
          <span class="pts">${fmt(s.score)}${s.xp ? `<small>+${fmt(s.xp)} XP</small>` : ''}</span>
        </summary>
        <div class="detail">${opBreakdown(s.byOp)}<small class="hint">${modeLabel(s)} · ${LEVELS[s.level] ? t(`lv.${s.level}`) : ''} · ${fmtDur(s.durMs)}</small></div>
      </details>`,
    )
    .join('');
}
$('skills').addEventListener('click', (e) => {
  const b = e.target.closest('[data-focus]');
  if (b) startGame('endless', { ops: [b.dataset.focus] });
});

/* ---------------- awards ---------------- */
// Cell order of img/awards.webp (6 columns, row-major). Ids missing here fall back to the emoji.
const AW_SPRITE = 'first goal1 days3 days7 days30 days100 combo10 combo25 combo50 sprint20 sprint35 daily1 daily10 dailyPerfect c100 c1000 c5000 lv5 lv10 quick flawless owl bird'.split(' ');
const AW_COLS = 6;
const AW_ROWS = Math.ceil(AW_SPRITE.length / AW_COLS);
function awIcon(a) {
  const i = AW_SPRITE.indexOf(a.id);
  if (i < 0) return `<span class="aw-icon" aria-hidden="true">${a.icon}</span>`;
  const x = ((i % AW_COLS) * 100) / (AW_COLS - 1);
  const y = (Math.floor(i / AW_COLS) * 100) / (AW_ROWS - 1);
  return `<span class="aw-icon aw-img" aria-hidden="true" style="background-position:${x}% ${y}%"></span>`;
}

function renderAwards() {
  const ctx = achievementContext(state);
  const got = ACHIEVEMENTS.filter((a) => state.achievements[a.id]).length;
  $('aw-count').textContent = `${got} / ${ACHIEVEMENTS.length}`;
  $('aw-fill').style.width = pct(got, ACHIEVEMENTS.length) + '%';
  // unlocked first, then the ones closest to unlocking
  const closeness = (a) => (state.achievements[a.id] ? 2 : a.goal ? Math.min(1, a.value(ctx) / a.goal) : 0);
  $('aw-grid').innerHTML = [...ACHIEVEMENTS]
    .sort((a, b) => closeness(b) - closeness(a))
    .map((a) => {
      const when = state.achievements[a.id];
      let foot = '';
      if (when) foot = `<small class="when">${fmtDay(when)}</small>`;
      else if (a.goal) {
        const v = Math.min(a.value(ctx), a.goal);
        foot = `<div class="bar"><i style="width:${pct(v, a.goal)}%"></i></div><small>${fmt(v)} / ${fmt(a.goal)}</small>`;
      }
      return `<div class="award ${when ? 'got' : ''}">${awIcon(a)}<b>${achText(a)[0]}</b><small>${achText(a)[1]}</small>${foot}</div>`;
    })
    .join('');
}

/* ---------------- settings ---------------- */
function renderSettings() {
  $('goal-seg').innerHTML = GOAL_OPTIONS.map(
    (g) =>
      `<label><input type="radio" name="goal" value="${g}" ${state.settings.goal === g ? 'checked' : ''}><span>${g}</span></label>`,
  ).join('');
  $('opt-sound').checked = state.settings.sound;
  $('opt-haptics').checked = state.settings.haptics;
  $('opt-phonepad').checked = state.settings.phonePad;
  $('opt-name').value = state.settings.name;
  $('opt-lang').innerHTML = [['', t('lang_auto')], ...Object.entries(LANGS)]
    .map(([k, l]) => `<option value="${k}" ${state.settings.lang === k ? 'selected' : ''}>${l}</option>`)
    .join('');
  renderAvatarSetting();
}
function renderAvatarSetting() {
  const avatar = state.settings.avatar;
  $('set-avatar').hidden = !avatar;
  $('avatar-ph').hidden = !!avatar;
  $('avatar-remove').hidden = !avatar;
  if (avatar) $('set-avatar').src = avatar;
}
$('opt-name').addEventListener('change', (e) => {
  state.settings.name = e.target.value.trim().slice(0, 24);
  e.target.value = state.settings.name;
  store.save(state);
});
$('opt-lang').addEventListener('change', (e) => {
  state.settings.lang = e.target.value;
  store.save(state);
  applyLang();
  go('settings');
});
function applyLang() {
  setLang(state.settings.lang);
  translateDom();
}
$('avatar-pick').addEventListener('click', () => $('file-avatar').click());
// Downscale to a small square JPEG so the data URL stays well within localStorage limits.
$('file-avatar').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const bmp = await createImageBitmap(file);
    const side = Math.min(bmp.width, bmp.height);
    const size = 192;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    canvas.getContext('2d').drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
    state.settings.avatar = canvas.toDataURL('image/jpeg', 0.85);
    if (!store.save(state)) fx.toast(t('photo_save_fail'));
    renderAvatarSetting();
  } catch {
    fx.toast(t('image_read_fail'));
  }
});
$('avatar-remove').addEventListener('click', () => {
  state.settings.avatar = '';
  store.save(state);
  renderAvatarSetting();
});
$('goal-seg').addEventListener('change', (e) => {
  state.settings.goal = Number(e.target.value);
  // lowering the goal can complete today right away (no bonus XP, but it keeps the streak honest)
  const day = state.days[dayKey()];
  if (day && !day.met && day.correct >= state.settings.goal) {
    day.met = true;
    state.records.goalsMet++;
    state.records.bestDayStreak = Math.max(state.records.bestDayStreak, dayStreak(state.days));
  }
  store.save(state);
});
$('opt-sound').addEventListener('change', (e) => {
  state.settings.sound = e.target.checked;
  fx.configure(state.settings);
  store.save(state);
  fx.sound('ok');
});
$('opt-haptics').addEventListener('change', (e) => {
  state.settings.haptics = e.target.checked;
  fx.configure(state.settings);
  store.save(state);
  fx.haptic(30);
});
$('opt-phonepad').addEventListener('change', (e) => {
  state.settings.phonePad = e.target.checked;
  $('pad').classList.toggle('phone', state.settings.phonePad);
  store.save(state);
});
$('btn-export').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `mathmind-backup-${dayKey()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  fx.toast(t('backup_dl'));
});
$('btn-import').addEventListener('click', () => $('file-import').click());
$('file-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const next = store.hydrate(JSON.parse(await file.text()));
    if (!confirm(t('import_confirm', { s: next.history.length, xp: fmt(next.xp) }))) return;
    state = next;
    store.save(state);
    fx.configure(state.settings);
    applyLang();
    fx.toast(t('backup_restored'));
    go('settings');
  } catch {
    fx.toast(t('not_backup'));
  }
});
$('btn-reset').addEventListener('click', () => {
  if (!confirm(t('reset_confirm'))) return;
  store.resetAll();
  state = store.load();
  fx.configure(state.settings);
  applyLang();
  fx.toast(t('progress_reset'));
  go('home');
});

/* ---------------- game ---------------- */
let game = null;
let tickId = 0;
let nextTimer = 0;
let lastPlay = { mode: 'endless', opts: {} };
const qcard = $('qcard');

function startGame(mode, opts = {}) {
  clearTimeout(nextTimer);
  cancelAnimationFrame(tickId);
  const today = dayKey();
  game = {
    mode,
    ops: mode === 'daily' ? [...OP_KEYS] : opts.ops || state.settings.ops,
    focus: opts.ops?.length === 1 ? opts.ops[0] : null,
    level: mode === 'daily' ? 'd23' : state.settings.level,
    dailyKey: mode === 'daily' ? today : null,
    sprintSec: mode === 'sprint' ? state.settings.sprintSec : null,
    queue: mode === 'daily' ? dailyQuestions(today) : null,
    startedAt: Date.now(),
    log: [],
    mistakes: [],
    streak: 0,
    score: 0,
    usedMs: 0, // total answering time (the Sprint clock ignores result pauses)
    q: null,
    lastText: '',
    input: '',
    locked: true,
    qStart: 0,
    hiddenAt: 0,
    hiddenTotal: 0,
    timeUp: false,
  };
  lastPlay = { mode, opts };

  $('hud-4-label').textContent = t({ endless: 'st.correct', sprint: 'time', daily: 'question' }[mode]);
  $('hud-bar').hidden = mode === 'endless';
  $('hud-bar').classList.remove('hurry');
  $('hud-4-item').classList.remove('hurry');
  updateHud();
  resetCard();
  pose(playMascot, 'hello');
  go('play');
  if (mode === 'endless') nextQuestion();
  else countdown();
}

function resetCard() {
  qcard.classList.remove('ok', 'bad', 'time');
  delete qcard.dataset.op;
  $('op-badge').textContent = '';
  $('result').hidden = true;
  $('question').textContent = '';
  $('answer-text').textContent = '';
  $('qhint').textContent = '';
  $('timer').textContent = '0.0s';
  $('pad').classList.add('locked');
}

function countdown() {
  const token = game;
  const el = $('countdown');
  const num = $('countdown-num');
  $('countdown-label').textContent = modeName(game.mode);
  el.hidden = false;
  let n = 3;
  const step = () => {
    if (game !== token) return;
    if (n === 0) {
      el.hidden = true;
      fx.sound('go');
      nextQuestion();
      return;
    }
    num.textContent = n--;
    restartAnim(num, 'tick');
    fx.sound('tick');
    nextTimer = setTimeout(step, 600);
  };
  step();
}

function nextQuestion() {
  let q;
  if (game.queue) q = game.queue[game.log.length];
  else {
    do q = generate(game.ops[Math.floor(Math.random() * game.ops.length)], game.level);
    while (q.text === game.lastText);
  }
  game.q = q;
  game.lastText = q.text;
  game.input = '';
  game.hiddenTotal = 0;
  game.hiddenAt = document.hidden ? performance.now() : 0;
  game.locked = false;

  qcard.classList.remove('ok', 'bad', 'time');
  $('result').hidden = true;
  $('pad').classList.remove('locked');
  qcard.dataset.op = q.op;
  $('op-badge').textContent = opName(q.op);
  $('question').innerHTML = `${q.a} <span class="op">${q.sym}</span> ${q.b}`;
  restartAnim($('question'), 'enter');
  pose(playMascot, 'think');
  $('qhint').textContent = q.op === 'div' ? t('div_hint') : '';
  $('key-dot').disabled = q.op !== 'div';
  renderAnswer();
  $('timer').textContent = '0.0s';
  lastShown = '0.0s';
  game.qStart = performance.now();
  updateHud();
  cancelAnimationFrame(tickId);
  tick();
}

function elapsed() {
  const now = document.hidden ? game.hiddenAt : performance.now();
  return Math.max(0, now - game.qStart - game.hiddenTotal);
}

let lastShown = '';
let lastSecond = -1;
function tick() {
  if (!game || game.locked) return;
  const ms = elapsed();
  const t = secs(ms);
  if (t !== lastShown) {
    $('timer').textContent = t;
    lastShown = t;
  }
  let hurry = ms > game.q.par * 1000; // past par: the speed bonus is draining away
  if (game.mode === 'sprint') {
    const left = game.sprintSec * 1000 - game.usedMs - ms;
    if (left <= 0) return timeUp();
    renderSprintClock(left);
    hurry ||= left <= 10_000;
  }
  if (hurry && playMascot.dataset.pose === 'think') pose(playMascot, 'nervous');
  tickId = requestAnimationFrame(tick);
}

function renderSprintClock(left) {
  const s = Math.ceil(left / 1000);
  $('hud-4').textContent = s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : `${s}s`;
  $('hud-bar-fill').style.width = `${left / (10 * game.sprintSec)}%`;
  const hurry = left <= 10_000;
  $('hud-4-item').classList.toggle('hurry', hurry);
  $('hud-bar').classList.toggle('hurry', hurry);
  if (s <= 3 && s !== lastSecond && !game.locked) fx.sound('tick');
  lastSecond = s;
}

function timeUp() {
  game.locked = true;
  game.timeUp = true;
  game.usedMs = game.sprintSec * 1000;
  renderSprintClock(0);
  $('pad').classList.add('locked');
  qcard.classList.remove('ok', 'bad');
  qcard.classList.add('time');
  $('result-icon').textContent = '⏰';
  pose(playMascot, 'oops');
  $('result-title').textContent = t('time_up');
  $('result-sub').textContent = t('n_correct', { n: game.log.filter((e) => e.correct).length });
  $('result-sub2').textContent = '';
  $('result-sub2').className = 'result-sub2';
  runPauseBar();
  $('result').hidden = false;
  fx.sound('timeup');
  fx.haptic([40, 60, 40]);
  const token = game;
  nextTimer = setTimeout(() => game === token && finishGame(), RESULT_PAUSE_MS);
}

document.addEventListener('visibilitychange', () => {
  if (!game || game.locked) return;
  if (document.hidden) {
    game.hiddenAt = performance.now();
  } else {
    game.hiddenTotal += performance.now() - game.hiddenAt;
    game.hiddenAt = 0;
    tick();
  }
});

function renderAnswer() {
  $('answer-text').textContent = game.input;
}

function updateHud() {
  const { log, streak, score, mode } = game;
  const correct = log.filter((e) => e.correct).length;
  $('hud-score').textContent = fmt(score);
  const mult = streak > 1 ? `<span class="mult">×${(1 + 0.1 * Math.min(streak - 1, 10)).toFixed(1)}</span>` : '';
  $('hud-streak').innerHTML = streak ? `🔥${streak}${mult}` : '0';
  $('hud-streak-item').classList.toggle('flame', streak >= 3);
  if (mode === 'endless') $('hud-4').textContent = `${correct}/${log.length}`;
  else if (mode === 'daily') {
    $('hud-4').textContent = `${Math.min(log.length + 1, DAILY_QUESTIONS)}/${DAILY_QUESTIONS}`;
    $('hud-bar-fill').style.width = `${(100 * log.length) / DAILY_QUESTIONS}%`;
  } else renderSprintClock(game.sprintSec * 1000 - game.usedMs);
}

function scorePop(points) {
  const el = document.createElement('span');
  el.className = 'pop';
  el.textContent = `+${points}`;
  $('hud-score').parentElement.append(el);
  el.addEventListener('animationend', () => el.remove());
}

function press(key) {
  if (!game || game.locked) return;
  let s = game.input;
  if (key === 'enter') return submit();
  if (key === 'back') s = s.slice(0, -1);
  else if (key === 'clear') s = '';
  else if (key === '.') {
    if (game.q.op !== 'div' || s.includes('.')) return;
    s = s === '' ? '0.' : s + '.';
  } else if (/^\d$/.test(key)) {
    const dot = s.indexOf('.');
    if (dot !== -1 && s.length - dot > 1) return; // max one decimal digit
    if (s.length >= MAX_INPUT_LEN) return;
    s = s === '0' ? key : s + key; // no leading zeros
  } else return;
  game.input = s;
  renderAnswer();
  // submit as soon as the typed value is right; wrong answers still need Enter
  if (s && checkAnswer(game.q, s).correct) submit();
}

function submit() {
  const { q } = game;
  const verdict = checkAnswer(q, game.input);
  if (!verdict.valid) {
    restartAnim($('answer'), 'shake');
    return;
  }

  const ms = Math.round(elapsed());
  game.locked = true;
  game.usedMs += ms;
  cancelAnimationFrame(tickId);
  $('timer').textContent = secs(ms);
  $('pad').classList.add('locked');

  let sc = null;
  if (verdict.correct) {
    game.streak++;
    sc = scoreAnswer(q, ms, game.streak);
    game.score += sc.points;
  } else {
    game.streak = 0;
    game.mistakes.push({ text: q.text, given: game.input, answer: q.answerText });
  }
  game.log.push({ op: q.op, correct: verdict.correct, ms, points: sc ? sc.points : 0 });
  store.savePending(snapshot(game));
  updateHud();

  const milestone = verdict.correct && game.streak % COMBO_EVERY === 0;
  if (sc) scorePop(sc.points);
  fx.sound(milestone ? 'combo' : verdict.correct ? 'ok' : 'bad');
  fx.haptic(verdict.correct ? 15 : [60, 40, 60]);
  showResult(verdict.correct, ms, sc, q, milestone);
  if (milestone) fx.confetti({ y: 0.32, count: Math.min(30 + game.streak * 3, 140), power: 0.75 });

  const token = game;
  clearTimeout(nextTimer);
  nextTimer = setTimeout(() => {
    if (game !== token) return;
    const over =
      (game.mode === 'daily' && game.log.length >= game.queue.length) ||
      (game.mode === 'sprint' && game.usedMs >= game.sprintSec * 1000);
    if (over) finishGame();
    else nextQuestion();
  }, RESULT_PAUSE_MS);
}

function showResult(ok, ms, sc, q, milestone) {
  qcard.classList.toggle('ok', ok);
  qcard.classList.toggle('bad', !ok);
  $('result-icon').textContent = ok ? '✓' : '✗';
  pose(playMascot, ok ? 'yay' : 'oops');
  const sub2 = $('result-sub2');
  sub2.className = 'result-sub2';
  if (ok) {
    $('result-title').textContent = secs(ms);
    $('result-sub').textContent = t('pts', { n: sc.points });
    if (milestone) {
      sub2.textContent = t('in_a_row', { n: game.streak });
      sub2.classList.add('milestone');
    } else {
      const bits = [];
      if (sc.speed >= 80) bits.push(t('lightning'));
      if (sc.mult > 1) bits.push(t('streak_x', { m: sc.mult.toFixed(1) }));
      sub2.textContent = bits.join('  ·  ');
    }
  } else {
    $('result-title').textContent = `${q.text} = ${q.answerText}`;
    $('result-sub').textContent = t('you_typed', { v: game.input });
    sub2.textContent = t('streak_reset');
  }
  runPauseBar();
  $('result').hidden = false;
}

function runPauseBar() {
  const bar = $('pause-bar');
  bar.style.setProperty('--pause', `${RESULT_PAUSE_MS}ms`);
  restartAnim(bar, 'run');
}

const snapshot = (g) => ({
  mode: g.mode,
  ops: g.ops,
  level: g.level,
  dailyKey: g.dailyKey,
  sprintSec: g.sprintSec,
  startedAt: g.startedAt,
  log: g.log,
  lastAt: Date.now(),
});

function buildSession(g, endTs) {
  return {
    id: g.startedAt,
    ts: g.startedAt,
    durMs: endTs - g.startedAt,
    mode: g.mode,
    ops: [...g.ops],
    level: g.level,
    dailyKey: g.dailyKey,
    ...(g.sprintSec && { sprintSec: g.sprintSec }),
    quick: g.log.some((e) => e.correct && (e.op === 'mul' || e.op === 'div') && e.ms < 3000),
    ...summarize(g.log),
  };
}

function finishGame() {
  if (!game) return;
  clearTimeout(nextTimer);
  cancelAnimationFrame(tickId);
  const g = game;
  game = null;
  store.clearPending();
  $('countdown').hidden = true;
  if (!g.log.length) return go('home');

  const session = buildSession(g, Date.now());
  const res = applySession(state, session);
  session.xp = res.xpGained;
  store.addSession(state, session);
  renderSummary(session, g, res);
  go('summary');
  celebrate(res);
}

function celebrate(res) {
  const big = res.after.level > res.before.level || res.goalJustMet || res.unlocked.length || res.best.score;
  if (big) {
    setTimeout(() => {
      fx.confetti({ y: 0.25, count: 160 });
      fx.sound('fanfare');
      fx.haptic([30, 50, 30, 50, 60]);
    }, 350);
  }
}

/* numpad: pointerdown for the lowest latency; click handles keyboard activation */
const pad = $('pad');
pad.addEventListener('pointerdown', (e) => {
  const btn = e.target.closest('button');
  if (!btn || btn.disabled) return;
  e.preventDefault();
  btn.classList.add('down');
  press(btn.dataset.k);
});
for (const ev of ['pointerup', 'pointercancel', 'pointerleave']) {
  pad.addEventListener(ev, (e) => e.target.closest?.('button')?.classList.remove('down'), true);
}
pad.addEventListener('click', (e) => {
  // pointerdown already handled real pointer input (detail > 0); this covers Enter/Space on a focused key
  if (e.detail === 0) {
    const btn = e.target.closest('button');
    if (btn && !btn.disabled) press(btn.dataset.k);
  }
});

document.addEventListener('keydown', (e) => {
  if (!game || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.('#btn-stop')) return; // let Enter/Space activate Stop
  const k = e.key;
  if (/^\d$/.test(k) || k === '.' || k === ',') press(k === ',' ? '.' : k);
  else if (k === 'Backspace') press('back');
  else if (k === 'Delete') press('clear');
  else if (k === 'Enter') press('enter');
  else if (k === 'Escape') return finishGame();
  else return;
  e.preventDefault();
});

$('btn-stop').addEventListener('click', finishGame);

/* ---------------- summary ---------------- */
function opBreakdown(byOp) {
  return OP_KEYS.filter((k) => byOp[k])
    .map((k) => {
      const o = byOp[k];
      const avg = o.c ? secs(o.ms / o.c) : '–';
      return `<div class="oprow" data-op="${k}"><b>${OPS[k].sym}</b>
        <div><div class="bar"><i style="width:${pct(o.c, o.n)}%"></i></div><small>${t('op_line', { c: o.c, n: o.n, avg })}</small></div>
        <span class="acc">${pct(o.c, o.n)}%</span></div>`;
    })
    .join('');
}

let lastShare = '';
function renderSummary(s, g, res) {
  const { mode } = s;
  const done = mode === 'daily' && s.total >= DAILY_QUESTIONS;
  $('sum-mode').textContent =
    `${MODES[mode].icon} ${modeLabel(s)}` + (g.focus ? ` · ${t('focus_tag', { op: opName(g.focus) })}` : '');
  $('sum-title').textContent = t({
    daily: done ? (s.correct === s.total ? 'perfect_daily' : 'daily_done_t') : 'challenge_stopped',
    sprint: g.timeUp ? 'time_up' : 'sprint_stopped',
    endless: s.total >= 10 && s.correct === s.total ? 'perfect_run' : 'nice_session',
  }[mode]);

  const badges = [];
  if (res.streakUp) badges.push(`🔥 ${t('streak_n', { n: res.dayStreak })}!`);
  if (res.best.score) badges.push(t('b_best_score'));
  if (res.best.combo) badges.push(t('b_best_combo'));
  if (res.best.avg) badges.push(t('b_fastest'));
  if (res.dailyRetry) badges.push(t('b_retry'));
  $('sum-badges').innerHTML = badges.map((b) => `<span class="badge">${b}</span>`).join('');
  $('sum-score').textContent = fmt(s.score);

  // XP + level
  $('sum-xp').textContent = `+${fmt(res.xpGained)} XP`;
  $('sum-level').textContent = t('level_title', { l: res.after.level, t: titleName(res.after.title) });
  $('sum-xp-lines').innerHTML = [{ label: t('points_earned'), xp: s.score }, ...res.bonuses.map((b) => ({ ...b, label: t(`bonus.${b.id}`) }))]
    .map((b) => `<li><span>${b.label}</span><b>+${fmt(b.xp)}</b></li>`)
    .join('');
  const levelUp = res.after.level > res.before.level;
  $('sum-levelup').hidden = !levelUp;
  $('sum-levelup').textContent = t('level_up', { t: titleName(res.after.title), l: res.after.level });
  const xpFill = $('sum-xp-fill');
  xpFill.style.transition = 'none';
  xpFill.style.width = levelUp ? '0%' : pct(res.before.into, res.before.need) + '%';

  // daily goal
  const goal = state.settings.goal;
  const day = res.day;
  $('sum-goal').textContent = day.met
    ? t('goal_done', { n: res.dayStreak })
    : t(res.dayStreak ? 'goal_left_keep' : 'goal_left_start', { c: day.correct, g: goal, n: goal - day.correct });
  const goalFill = $('sum-goal-fill');
  goalFill.style.transition = 'none';
  goalFill.style.width = pct(day.correct - s.correct, goal) + '%';
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      xpFill.style.transition = goalFill.style.transition = '';
      xpFill.style.width = pct(res.after.into, res.after.need) + '%';
      goalFill.style.width = pct(day.correct, goal) + '%';
    }),
  );

  // achievements
  $('sum-ach').hidden = !res.unlocked.length;
  $('sum-ach').querySelector('h2').textContent = t('ach_unlocked', { n: res.unlocked.length });
  $('sum-ach-list').innerHTML = res.unlocked
    .map(
      (a, i) =>
        `<div class="ach-item" style="animation-delay:${0.15 * i}s">${awIcon(a)}<div><b>${achText(a)[0]}</b><small>${achText(a)[1]}</small></div></div>`,
    )
    .join('');

  $('sum-grid').innerHTML =
    stat(t('st.correct'), `${s.correct}/${s.total}`) +
    stat(t('st.accuracy'), `${pct(s.correct, s.total)}%`) +
    stat(t('st.avg_time'), s.avgMs != null ? secs(s.avgMs) : '–') +
    stat(t('st.fastest'), s.fastestMs != null ? secs(s.fastestMs) : '–') +
    stat(t('st.best_combo'), `⚡ ${s.bestStreak}`) +
    stat(t(mode === 'daily' ? 'st.total_time' : 'st.duration'), mode === 'daily' ? secs(s.answerMs) : fmtDur(s.durMs));
  $('sum-ops').innerHTML = opBreakdown(s.byOp);
  $('sum-miss-card').hidden = !g.mistakes.length;
  $('sum-miss').innerHTML = g.mistakes
    .map((m) => `<li><span>${m.text} = <b>${m.answer}</b></span><s>${m.given}</s></li>`)
    .join('');

  $('sum-again').textContent = t(mode === 'daily' ? 'retry_challenge' : mode === 'sprint' ? 'sprint_again' : 'play_again');
  $('sum-share').hidden = !done;
  if (done) {
    const rows = [];
    for (let i = 0; i < g.log.length; i += 5) rows.push(g.log.slice(i, i + 5).map((e) => (e.correct ? '🟩' : '🟥')).join(''));
    lastShare = [
      `MathMind Daily ${s.dailyKey}`,
      `${s.correct}/${s.total} · ${fmt(s.score)} pts · ${secs(s.answerMs)}`,
      ...rows,
      res.dayStreak ? `🔥 ${t('streak_n', { n: res.dayStreak })}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}

$('sum-again').addEventListener('click', () => startGame(lastPlay.mode, lastPlay.opts));
$('sum-home').addEventListener('click', () => go('home'));
$('sum-share').addEventListener('click', async () => {
  try {
    if (navigator.share) await navigator.share({ text: lastShare });
    else {
      await navigator.clipboard.writeText(lastShare);
      fx.toast(t('copied'));
    }
  } catch (err) {
    if (err?.name !== 'AbortError') fx.toast(t('share_fail'));
  }
});

/* ---------------- recovery of an unfinished session ---------------- */
function recoverPending() {
  const p = store.takePending();
  if (!p?.log?.length || !MODES[p.mode]) return;
  const session = buildSession(p, p.lastAt || Date.now());
  const res = applySession(state, session);
  session.xp = res.xpGained;
  store.addSession(state, session);
  fx.toast(t('recovered', { mode: modeName(p.mode), xp: fmt(res.xpGained) }));
}

/* ---------------- PWA ---------------- */
let installEvt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installEvt = e;
  $('btn-install').hidden = false;
});
$('btn-install').addEventListener('click', async () => {
  if (!installEvt) return;
  installEvt.prompt();
  await installEvt.userChoice;
  installEvt = null;
  $('btn-install').hidden = true;
});
window.addEventListener('appinstalled', () => ($('btn-install').hidden = true));

if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

translateDom();
recoverPending();
go('home');
