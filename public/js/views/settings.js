import { GOAL_OPTIONS, dayKey, dayStreak } from '../progress.js';
import * as store from '../store.js';
import * as fx from '../fx.js';
import { LANGS, t, setLang, translateDom } from '../i18n.js';
import { state, replaceState } from '../state.js';
import { $, fmt } from '../util.js';
import { go } from '../nav.js';

export function renderSettings() {
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

export function applyLang() {
  setLang(state.settings.lang);
  translateDom();
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
    replaceState(next);
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
  replaceState(store.load());
  fx.configure(state.settings);
  applyLang();
  fx.toast(t('progress_reset'));
  go('home');
});
