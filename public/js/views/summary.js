import { MODES, DAILY_QUESTIONS, DAILY_DIFFS, DEFAULT_DIFF } from '../engine.js';
import { LESSON_QUESTIONS } from '../lessons.js';
import * as fx from '../fx.js';
import { t } from '../i18n.js';
import { state } from '../state.js';
import { $, secs, pct, fmt, fmtDur, opName, titleName, achText, modeLabel, stat, opBreakdown } from '../util.js';
import { go } from '../nav.js';
import { awIcon } from './awards.js';

// The "Play again" button is wired in game.js, which owns startGame and the last-played options.
let lastShare = '';
let lastMode = '';

export function renderSummary(s, g, res) {
  const { mode } = s;
  lastMode = mode;
  const done = mode === 'daily' && s.total >= DAILY_QUESTIONS;
  $('sum-mode').textContent =
    `${MODES[mode].icon} ${modeLabel(s)}` + (g.focus ? ` · ${t('focus_tag', { op: opName(g.focus) })}` : '');
  $('sum-title').textContent = t({
    daily: done ? (s.correct === s.total ? 'perfect_daily' : 'daily_done_t') : 'challenge_stopped',
    sprint: g.timeUp ? 'time_up' : 'sprint_stopped',
    endless: s.total >= 10 && s.correct === s.total ? 'perfect_run' : 'nice_session',
    lesson: s.total >= LESSON_QUESTIONS ? (s.correct === s.total ? 'perfect_run' : 'lesson_done_t') : 'lesson_stopped',
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
    .map((m) => `<li><span>${m.text} = <b>${m.answer}</b></span><s>${m.given || '—'}</s></li>`)
    .join('');

  $('sum-again').textContent = t(
    { daily: 'retry_challenge', sprint: 'sprint_again', lesson: 'practice_again' }[mode] || 'play_again',
  );
  $('sum-home').textContent = t(mode === 'lesson' ? 'back_learn' : 'done');
  $('sum-share').hidden = !done;
  if (done) {
    const rows = [];
    for (let i = 0; i < g.log.length; i += 5) rows.push(g.log.slice(i, i + 5).map((e) => (e.correct ? '🟩' : '🟥')).join(''));
    lastShare = [
      `MathMind Daily ${s.dailyKey} ${DAILY_DIFFS[s.diff || DEFAULT_DIFF].icon} ${DAILY_DIFFS[s.diff || DEFAULT_DIFF].label}`,
      `${s.correct}/${s.total} · ${fmt(s.score)} pts · ${secs(s.answerMs)}`,
      ...rows,
      res.dayStreak ? `🔥 ${t('streak_n', { n: res.dayStreak })}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  }
}

$('sum-home').addEventListener('click', () => go(lastMode === 'lesson' ? 'learn' : 'home'));
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
