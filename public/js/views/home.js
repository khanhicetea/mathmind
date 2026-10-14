import { OPS, OP_KEYS, LEVELS, SPRINT_SECONDS, DAILY_QUESTIONS, DAILY_DIFFS, DAILY_DIFF_KEYS, dailyId } from '../engine.js';
import { dayKey, addDays, keyToDate, dayStreak, levelInfo, scoreKey } from '../progress.js';
import * as store from '../store.js';
import * as fx from '../fx.js';
import { t, getLang } from '../i18n.js';
import { state } from '../state.js';
import { $, pct, fmt, opName, diffName, titleName, sprintLabel } from '../util.js';
import { startGame } from '../game.js';

const RING_C = 2 * Math.PI * 27;

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return t('greet.late');
  if (h < 12) return t('greet.morning');
  if (h < 18) return t('greet.afternoon');
  return t('greet.evening');
}

export function renderHome() {
  const today = dayKey();
  const goal = state.settings.goal;
  const day = state.days[today] || { correct: 0, met: false };
  const streak = dayStreak(state.days, today);
  const lv = levelInfo(state.xp);

  const name = state.settings.name;
  $('greet').textContent = name || greeting();
  const avatar = state.settings.avatar;
  $('home-avatar').hidden = !avatar;
  $('home-avatar-ph').hidden = !!avatar;
  if (avatar) $('home-avatar').src = avatar;

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
  renderDailyMode();
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
    .filter(([, l]) => !l.hidden)
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

function renderDailyMode() {
  const today = dayKey();
  const diff = state.settings.dailyDiff;
  const daily = state.daily[dailyId(today, diff)];
  $('mode-daily-sub').textContent = daily
    ? t('daily_done', { c: daily.correct, q: DAILY_QUESTIONS, p: fmt(daily.score) })
    : t('daily_new', { q: DAILY_QUESTIONS, d: t(`lv.${DAILY_DIFFS[diff].level}`) });
  $('mode-daily-badge').textContent = daily ? t('cta_replay') : t('cta_play');
  $('mode-daily-badge').classList.toggle('done', !!daily);
  $('daily-diff').innerHTML = DAILY_DIFF_KEYS.map(
    (k) =>
      `<button class="diff-pill" data-diff="${k}" aria-pressed="${k === diff}">${diffName(k)}${state.daily[dailyId(today, k)] ? ' <span aria-hidden="true">✓</span>' : ''}</button>`,
  ).join('');
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
$('daily-diff').addEventListener('click', (e) => {
  const b = e.target.closest('[data-diff]');
  if (!b || b.dataset.diff === state.settings.dailyDiff) return;
  state.settings.dailyDiff = b.dataset.diff;
  store.save(state);
  renderDailyMode();
  fx.haptic(10);
});
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
