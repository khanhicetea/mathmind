import { OPS, OP_KEYS, MODES, DAILY_QUESTIONS, DAILY_DIFFS, DEFAULT_DIFF } from './engine.js';
import { t, getLang } from './i18n.js';

export const $ = (id) => document.getElementById(id);

/* ---------------- formatting ---------------- */
export const secs = (ms) => (ms / 1000).toFixed(1) + 's';
export const pct = (n, d) => (d ? Math.min(100, Math.round((100 / d) * n)) : 0);
export const fmt = (n) => Number(n || 0).toLocaleString(getLang());
export const fmtDate = (ts) =>
  new Intl.DateTimeFormat(getLang(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(ts);
export const fmtDay = (ts) => new Intl.DateTimeFormat(getLang(), { month: 'short', day: 'numeric', year: 'numeric' }).format(ts);
export const fmtDur = (ms) => {
  const s = Math.round(ms / 1000);
  return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`;
};

/* ---------------- labels ---------------- */
export const sprintLabel = (sec) => (sec % 60 ? `${sec}s` : t('min', { n: sec / 60 }));
export const opName = (k) => t(`op.${k}`);
export const modeName = (m) => t(`mode.${m}`);
export const diffName = (d) => t(`diff.${DAILY_DIFFS[d] ? d : DEFAULT_DIFF}`);
export const titleName = (title) => t(`title.${title}`);
export const lessonName = (id) => t(`ln.${id}`);
export const achText = (a) => t(`ach.${a.id}`).map((x) => x.replace(/\{q\}/g, DAILY_QUESTIONS));
export const modeLabel = (s) =>
  (MODES[s.mode] ? modeName(s.mode) : '') +
  (s.mode === 'sprint'
    ? ` ${sprintLabel(s.sprintSec || 60)}`
    : s.mode === 'daily'
      ? ` · ${diffName(s.diff)}`
      : s.mode === 'lesson'
        ? ` · ${lessonName(s.lesson)}`
        : '');

/* ---------------- markup + animation ---------------- */
export const stat = (label, value) => `<div class="stat"><small>${label}</small><b>${value}</b></div>`;

export const restartAnim = (el, cls) => {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
};

// Per-operation accuracy rows, shared by the Progress history and the session summary.
export function opBreakdown(byOp) {
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
