import { ACHIEVEMENTS, achievementContext } from '../progress.js';
import { state } from '../state.js';
import { $, pct, fmt, fmtDay, achText } from '../util.js';

// Cell order of img/awards.webp (6 columns, row-major). Ids missing here fall back to the emoji.
const AW_SPRITE = 'first goal1 days3 days7 days30 days100 combo10 combo25 combo50 sprint20 sprint35 daily1 daily10 dailyPerfect c100 c1000 c5000 lv5 lv10 quick flawless owl bird'.split(' ');
const AW_COLS = 6;
const AW_ROWS = Math.ceil(AW_SPRITE.length / AW_COLS);

export function awIcon(a) {
  const i = AW_SPRITE.indexOf(a.id);
  if (i < 0) return `<span class="aw-icon" aria-hidden="true">${a.icon}</span>`;
  const x = ((i % AW_COLS) * 100) / (AW_COLS - 1);
  const y = (Math.floor(i / AW_COLS) * 100) / (AW_ROWS - 1);
  return `<span class="aw-icon aw-img" aria-hidden="true" style="background-position:${x}% ${y}%"></span>`;
}

export function renderAwards() {
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
