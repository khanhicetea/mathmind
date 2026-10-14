import { $ } from './util.js';

// Mascot: CSS animates each pose (see .mascot in style.css); re-setting a pose replays its motion.
export const homeMascot = $('home-mascot');
export const playMascot = $('play-mascot');

export function pose(el, name) {
  if (el.dataset.pose === name) {
    el.removeAttribute('data-pose');
    void el.offsetWidth;
  }
  el.dataset.pose = name;
}

export function wave() {
  pose(homeMascot, 'hello');
}

homeMascot.addEventListener('animationend', (e) => {
  if (e.animationName === 'm-wave') pose(homeMascot, 'idle');
});
homeMascot.addEventListener('click', wave);
