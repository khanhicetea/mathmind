# MathMind

A static, installable (PWA) mental-math trainer built to be played **a few minutes every day**.
`+ − ×` with 2–3 digit numbers, `÷` answers rounded to 1 decimal. Everything stays on the device.

## Game modes

| Mode | What it is |
| --- | --- |
| 📅 **Daily Challenge** | 15 questions (all four ops) in three difficulties picked right on the card — 🟢 Easy (1–2 digits, whole-number ÷, +150 XP), 🟡 Medium (2–3 digits, +250 XP), 🔴 Hard (3 digits, +400 XP). Each difficulty is seeded by the date, so everyone gets the same set each day. The first completed attempt per difficulty is your official result; retries are for practice. Shareable Wordle-style result (🟩🟥). |
| ⏱️ **Sprint** | As many as you can in 1, 3 or 5 minutes of answering time (the 1s result pause doesn't eat your clock). 3-2-1 countdown. Each length keeps its own best score. |
| ♾️ **Endless** | Relaxed practice until you press **Stop**, using your chosen operations and number size. |

## Learn

The **Learn** tab teaches *how* to calculate in your head with step-by-step visual lessons, built on one idea:
remember a few facts, work out the rest with a rule. Each lesson is a short animated walkthrough, then a 6-question
practice played through the normal game loop (number pad, XP, daily goal). A missed practice question shows the trick
for that question. Finishing a lesson's practice for the first time marks it ✓ and gives +100 XP.

25 lessons in five groups. Most are equation walkthroughs that end in a 3-choice question; the times table and
"Split it up" have their own interactive stages.

| Group | Lessons |
| --- | --- |
| **Start here** | The shrinking times table (81 → 15 facts) · What a number is made of · Pairs that make 10 · Gaps to 100 and 1000 |
| **Add & subtract** | Add from the left · Three-digit adding · Round, then fix · Count up to subtract · Shift both numbers |
| **Multiply** | Split it up (area model + slider) · Tens × tens · Two-digit × two-digit · Round, then fix (×) · Shortcuts for ×5, ×9, ×11 · Halve one, double the other · Squares & near-squares |
| **Divide** | Division is × backwards · Split it up (÷) · Divide by halving · Leftovers become decimals · Round to one decimal · Leftover cheat sheet · Divide by a 2-digit number |
| **Check your answer** | Estimate & check (round to tens, then check the last digit) |

Lesson content lives in `js/lessons.js` (pure, tested); each lesson's visual is a stage in `js/views/learn.js`.

Every answer gets a 1-second result screen; a correct answer submits the instant it's typed (wrong ones need Enter).

## Habit & progression

- **Daily goal** (10/20/30/50 correct answers, default 20) with a progress ring, plus a **day streak** that grows each day you hit it.
  It stays alive until the end of today, and a 7-day strip shows the week.
- **XP & levels:** points become XP; +250 XP for the daily goal and +150/+250/+400 XP for the Daily Challenge (by difficulty). Titles go from Beginner to Grandmaster.
- **24 achievements:** streaks, combos, Sprint marks, Daily Challenge, lifetime answers, levels, plus a few fun ones (Night Owl, Quick Draw…). Locked ones show progress.
- **In-game juice:** combo multiplier in the HUD, a score pop, 🔥 milestone every 5 in a row with confetti, plus sounds and haptics (each can be turned off).
- **Progress tab:** records, a 17-week activity heatmap, per-operation **skills** (accuracy and speed) with the weakest op flagged
  **Focus** and a one-tap focused practice, plus recent sessions.
- The app-icon badge shows while today's goal is open (installed PWA, where supported).

## Scoring

Correct = 100 + up to 100 speed bonus (full at 0s, zero at 2× the question's par time) × streak multiplier
(×1.0, +0.1 per consecutive correct, max ×2.0). Wrong = 0 and the streak resets.

## Data

`localStorage` (`mathmind.v2`): settings, the last 300 sessions, per-day totals, lifetime per-op stats, records, achievements.
An in-progress session is snapshotted after every answer, so closing the app mid-game doesn't lose it; it's saved on next launch.
v1 data is migrated automatically. **Settings → Export/Import backup** moves progress between devices.

## Develop

No build step. Everything that ships lives in `public/`.

```sh
npm install        # installs wrangler (dev dependency)
npm run dev        # wrangler dev → http://localhost:8787 (same routing + _headers as production)
npm test           # unit tests (node:test) for engine + progression
```

## Deploy (Cloudflare Workers, static assets)

`wrangler.jsonc` defines an **assets-only Worker**: no script, so Cloudflare serves `public/` straight from its
asset store and requests never invoke (or bill) a Worker.

```sh
npx wrangler login     # once
npm run deploy         # runs the tests, then wrangler deploy → https://mathmind.<your-subdomain>.workers.dev
npx wrangler deploy --dry-run   # validate without uploading
```

- `public/_headers` adds security headers (CSP, nosniff, Permissions-Policy) plus longer caching for fonts and icons.
  Everything else keeps Cloudflare's default `max-age=0, must-revalidate` + ETag, so new versions (including `sw.js`)
  are picked up right away.
- Unknown URLs get `public/404.html` with a real 404 status (`not_found_handling: "404-page"`).
- Cloudflare redirects `/index.html` → `/` (307), so the service worker caches the shell under `./`, never `index.html`.
- To use your own domain, add a `routes` / custom-domain entry in `wrangler.jsonc` (or attach it in the dashboard).
- When you **add or remove** files in `public/`, update the `SHELL` list in `public/sw.js` and bump `VERSION`.

## Look & feel

Warm, sunny palette for kids and K-12: cream background with polka dots, tangerine → bubblegum buttons,
a sky → teal daily card and sunshine-yellow rewards. Every operation has its own colour everywhere
(+ green, − sky, × pink, ÷ amber). Playful **Mali** for headings and numbers and **Nunito** for text,
self-hosted in `public/fonts/` (SIL OFL, licences included) so the app keeps working offline.
Light and dark mode follow the system.

## Layout

```
wrangler.jsonc            Cloudflare Workers config (assets-only)
public/
  index.html              screens: home · learn · lesson · progress · awards · settings · play · summary
  404.html, _headers      Cloudflare not-found page + response headers
  css/style.css           theme (light + dark)
  fonts/                  Mali + Nunito + M PLUS Rounded 1c (Japanese subset, woff2) and their OFL licences
  js/engine.js            questions, daily seed, checking, scoring              (pure, tested)
  js/lessons.js           Learn catalog, times-table rules, lesson practice sets  (pure, tested)
  js/progress.js          days/streaks, XP/levels, achievements, skills, heatmap (pure, tested)
  js/store.js             localStorage, v1 migration, pending-session snapshot, backup hydrate
  js/fx.js                sound, haptics, confetti, toasts
  js/app.js               entry point: wires modules, registers views, boots
  js/state.js             the single shared app state (+ replaceState for import/reset)
  js/util.js              $ helper, formatters, labels, shared markup helpers
  js/nav.js               tab bar + go(view); views register their renderer
  js/mascot.js            mascot poses
  js/game.js              game loop: modes, timer, numpad/keyboard, scoring, session recovery
  js/pwa.js               install prompt + service-worker registration
  js/views/               home · learn · progress · awards · settings · summary (render + event wiring each)
  sw.js, manifest.webmanifest, icons/
test/                     node:test unit tests
```
