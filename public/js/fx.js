// Feedback effects: sound, haptics, confetti, toasts. All optional and failure-tolerant.
const opts = { sound: true, haptics: true };
export const configure = (o) => Object.assign(opts, { sound: o.sound, haptics: o.haptics });

/* ---------------- sound ---------------- */
let actx;
function tone(freq, start, dur, type = 'sine', gain = 0.12) {
  const o = actx.createOscillator();
  const g = actx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(gain, actx.currentTime + start);
  g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + start + dur);
  o.connect(g).connect(actx.destination);
  o.start(actx.currentTime + start);
  o.stop(actx.currentTime + start + dur);
}
const arpeggio = (notes, step, dur, gain) => notes.forEach((f, i) => tone(f, i * step, dur, 'triangle', gain));

const SOUNDS = {
  ok: () => {
    tone(660, 0, 0.12);
    tone(990, 0.08, 0.18);
  },
  bad: () => tone(180, 0, 0.28, 'sawtooth', 0.09),
  combo: () => arpeggio([523, 659, 784, 1047], 0.07, 0.16, 0.1),
  tick: () => tone(880, 0, 0.07, 'square', 0.04),
  go: () => tone(1320, 0, 0.22, 'triangle', 0.1),
  timeup: () => arpeggio([784, 587, 392], 0.12, 0.22, 0.1),
  fanfare: () => arpeggio([523, 659, 784, 1047, 1319], 0.09, 0.28, 0.11),
};

export function sound(name) {
  if (!opts.sound) return;
  try {
    actx ||= new (window.AudioContext || window.webkitAudioContext)();
    if (actx.state === 'suspended') actx.resume();
    SOUNDS[name]();
  } catch {
    /* audio is optional */
  }
}

export function haptic(pattern) {
  if (opts.haptics) navigator.vibrate?.(pattern);
}

/* ---------------- confetti ---------------- */
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const COLORS = ['#ff7a1a', '#f03c7e', '#1fb0f0', '#22b55a', '#ffc93c', '#14c3a0', '#ff6b6b'];
let canvas;
let cx;
let parts = [];
let raf = 0;

export function confetti({ x = 0.5, y = 0.3, count = 120, power = 1 } = {}) {
  if (reduced.matches) return;
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'confetti';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.append(canvas);
    cx = canvas.getContext('2d');
  }
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = (3 + Math.random() * 9) * power;
    parts.push({
      x: x * innerWidth,
      y: y * innerHeight,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 7 * power,
      r: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 0.4,
      s: 6 + Math.random() * 6,
      c: COLORS[i % COLORS.length],
      life: 1,
    });
  }
  if (!raf) raf = requestAnimationFrame(step);
}

function step() {
  cx.clearRect(0, 0, innerWidth, innerHeight);
  parts = parts.filter((p) => p.y < innerHeight + 20 && p.life > 0);
  for (const p of parts) {
    p.vx *= 0.985;
    p.vy = p.vy * 0.985 + 0.35;
    p.x += p.vx;
    p.y += p.vy;
    p.r += p.vr;
    p.life -= 0.007;
    cx.save();
    cx.translate(p.x, p.y);
    cx.rotate(p.r);
    cx.globalAlpha = Math.min(1, p.life * 2);
    cx.fillStyle = p.c;
    cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    cx.restore();
  }
  raf = parts.length ? requestAnimationFrame(step) : 0;
}

/* ---------------- toast ---------------- */
let toastBox;
export function toast(msg, ms = 2800) {
  if (!toastBox) {
    toastBox = document.createElement('div');
    toastBox.className = 'toasts';
    toastBox.setAttribute('role', 'status');
    document.body.append(toastBox);
  }
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  toastBox.append(t);
  setTimeout(() => {
    t.classList.add('out');
    setTimeout(() => t.remove(), 300);
  }, ms);
}
