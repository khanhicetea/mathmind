import { $ } from './util.js';
import { wave } from './mascot.js';

const TABS = ['home', 'learn', 'progress', 'awards', 'settings'];
const renderers = {};

// Views register their renderer here (see app.js) so nav never imports a view.
export function registerView(name, render) {
  renderers[name] = render;
}

export function go(name) {
  renderers[name]?.();
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
$('me-btn').addEventListener('click', () => go('awards'));
