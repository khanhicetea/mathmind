import { OPS, OP_KEYS, LEVELS, MODES, SPRINT_SECONDS, DAILY_DIFF_KEYS } from '../engine.js';
import { dayStreak, heatmap, keyToDate, achievementContext, skillStats } from '../progress.js';
import { t, getLang } from '../i18n.js';
import { state } from '../state.js';
import { $, secs, pct, fmt, fmtDate, fmtDay, fmtDur, opName, diffName, sprintLabel, modeLabel, stat, opBreakdown } from '../util.js';
import { startGame } from '../game.js';

export function renderProgress() {
  const r = state.records;
  const ctx = achievementContext(state);
  const totals = OP_KEYS.reduce((t, k) => t + (state.ops[k]?.n || 0), 0);
  $('prog-bests').innerHTML =
    stat(t('st.day_streak'), `🔥 ${dayStreak(state.days)}`) +
    stat(t('st.longest'), t('days', { n: r.bestDayStreak })) +
    SPRINT_SECONDS.map((sec) => stat(t('st.sprint_best', { len: sprintLabel(sec) }), fmt(r.score[`sprint${sec}`]))).join('') +
    DAILY_DIFF_KEYS.map((d) => stat(t('st.daily_best', { d: diffName(d) }), fmt(r.score[`daily_${d}`]))).join('') +
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
