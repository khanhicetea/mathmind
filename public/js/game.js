import {
  OP_KEYS,
  MODES,
  DAILY_QUESTIONS,
  DAILY_DIFFS,
  RESULT_PAUSE_MS,
  SKIP_PENALTY,
  generate,
  dailyQuestions,
  checkAnswer,
  scoreAnswer,
  summarize,
} from './engine.js';
import { dayKey, applySession } from './progress.js';
import * as store from './store.js';
import * as fx from './fx.js';
import { t } from './i18n.js';
import { state } from './state.js';
import { $, secs, fmt, opName, modeName, restartAnim } from './util.js';
import { pose, playMascot } from './mascot.js';
import { go } from './nav.js';
import { renderSummary } from './views/summary.js';

const MAX_INPUT_LEN = 7;
const COMBO_EVERY = 5;
const SKIP_AFTER_MS = { daily: 10_000, endless: 20_000, sprint: 1_000 };

let game = null;
let tickId = 0;
let nextTimer = 0;
let lastPlay = { mode: 'endless', opts: {} };
let lastShown = '';
let lastSecond = -1;
const qcard = $('qcard');

/* ---------------- lifecycle ---------------- */
export function startGame(mode, opts = {}) {
  clearTimeout(nextTimer);
  cancelAnimationFrame(tickId);
  const today = dayKey();
  const diff = mode === 'daily' ? opts.diff || state.settings.dailyDiff : null;
  game = {
    mode,
    ops: mode === 'daily' ? [...OP_KEYS] : opts.ops || state.settings.ops,
    focus: opts.ops?.length === 1 ? opts.ops[0] : null,
    level: mode === 'daily' ? DAILY_DIFFS[diff].level : state.settings.level,
    dailyKey: mode === 'daily' ? today : null,
    diff,
    sprintSec: mode === 'sprint' ? state.settings.sprintSec : null,
    queue: mode === 'daily' ? dailyQuestions(today, diff) : null,
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
  lastPlay = { mode, opts: diff ? { ...opts, diff } : opts }; // a retry replays the same difficulty

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
  const decimal = q.op === 'div' && !q.whole;
  $('qhint').textContent = decimal ? t('div_hint') : '';
  $('key-dot').disabled = !decimal;
  renderAnswer();
  $('btn-skip').hidden = true;
  $('timer').textContent = '0.0s';
  lastShown = '0.0s';
  game.qStart = performance.now();
  updateHud();
  cancelAnimationFrame(tickId);
  tick();
}

function scheduleNext() {
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

/* ---------------- clock ---------------- */
function elapsed() {
  const now = document.hidden ? game.hiddenAt : performance.now();
  return Math.max(0, now - game.qStart - game.hiddenTotal);
}

function tick() {
  if (!game || game.locked) return;
  const ms = elapsed();
  const shown = secs(ms);
  if (shown !== lastShown) {
    $('timer').textContent = shown;
    lastShown = shown;
  }
  if (ms >= SKIP_AFTER_MS[game.mode]) $('btn-skip').hidden = false;
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

/* ---------------- HUD + answering ---------------- */
function renderAnswer() {
  $('answer-text').textContent = game.input;
}

function updateHud() {
  const { log, streak, score, mode } = game;
  const correct = log.filter((e) => e.correct).length;
  $('hud-score').textContent = fmt(Math.max(0, score));
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
    if (game.q.op !== 'div' || game.q.whole || s.includes('.')) return;
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
  $('btn-skip').hidden = true;
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

  scheduleNext();
}

function skip() {
  if (!game || game.locked || $('btn-skip').hidden) return;
  const { q } = game;
  const ms = Math.round(elapsed());
  game.locked = true;
  $('btn-skip').hidden = true;
  game.usedMs += ms;
  cancelAnimationFrame(tickId);
  $('timer').textContent = secs(ms);
  $('pad').classList.add('locked');

  game.streak = 0;
  game.score -= SKIP_PENALTY;
  game.mistakes.push({ text: q.text, given: '', answer: q.answerText });
  game.log.push({ op: q.op, correct: false, skipped: true, ms, points: -SKIP_PENALTY });
  store.savePending(snapshot(game));
  updateHud();

  fx.sound('bad');
  fx.haptic(40);
  qcard.classList.add('bad');
  qcard.classList.remove('ok');
  $('result-icon').textContent = '⏭';
  pose(playMascot, 'oops');
  $('result-title').textContent = `${q.text} = ${q.answerText}`;
  $('result-sub').textContent = t('skip_pen', { n: SKIP_PENALTY });
  $('result-sub2').textContent = '';
  $('result-sub2').className = 'result-sub2';
  runPauseBar();
  $('result').hidden = false;
  scheduleNext();
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

/* ---------------- sessions ---------------- */
const snapshot = (g) => ({
  mode: g.mode,
  ops: g.ops,
  level: g.level,
  dailyKey: g.dailyKey,
  diff: g.diff,
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
    ...(g.diff && { diff: g.diff }),
    ...(g.sprintSec && { sprintSec: g.sprintSec }),
    quick: g.log.some((e) => e.correct && (e.op === 'mul' || e.op === 'div') && e.ms < 3000),
    ...summarize(g.log),
  };
}

// Recovery of an unfinished session (the app was closed mid-game).
export function recoverPending() {
  const p = store.takePending();
  if (!p?.log?.length || !MODES[p.mode]) return;
  const session = buildSession(p, p.lastAt || Date.now());
  const res = applySession(state, session);
  session.xp = res.xpGained;
  store.addSession(state, session);
  fx.toast(t('recovered', { mode: modeName(p.mode), xp: fmt(res.xpGained) }));
}

/* ---------------- input wiring ---------------- */
// numpad: pointerdown for the lowest latency; click handles keyboard activation
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

$('btn-skip').addEventListener('click', skip);
$('btn-stop').addEventListener('click', finishGame);
$('sum-again').addEventListener('click', () => startGame(lastPlay.mode, lastPlay.opts));
