# Building a new Good News Games mini-game

Repo: /home/user/Jesus-rises (a collection of single-file HTML5 canvas cartoon Bible games for young children, packaged as an iPhone/iPad/Android app with Capacitor). The players are children of roughly 5–10, play-tested on real phones by a parent and their kids. They like games that are fun, clear, a bit challenging, and that get harder level by level. A game that is "too easy" or confusing gets cut.

## Start from the house template

Read `lost-coin.html` fully first and copy its structure and conventions (it is a clean, recent game). Also skim `shepherds-angels.html` and `palm-sunday.html` for more ambitious examples. Your game must keep ALL of these house rules:

- One self-contained file in the repo root (e.g. `david-goliath.html`). Art is drawn in code on a `<canvas id="game">`; no images, no audio files, no libraries.
- Exactly this head:
  - `<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">` (never change it)
  - `<link href="fonts/fonts.css" rel="stylesheet">` (the Fredoka font is bundled; NO Google Fonts, NO external URLs of any kind — the app must work offline)
  - `<script src="bible.js"></script>` and `<script src="music.js"></script>`
- Logical playfield height H = 900, `MIN_W` 480, `MAX_W` ~1300, and the same `resize()` pattern (scale/viewW/viewH/W/offX/offY, dpr capped at 2). It must look right on phones (portrait) AND iPads (portrait 820×1180 and landscape 1376×1032): fill the extra space sensibly (sky, ground), never leave important things off-screen.
- The overlay card UI (`#overlay`, `.card`, `#ovBtn`, `#ovBtn2`, `#ovHome` "All games" link to `index.html`) for the title card, level cards, win/fail cards and the pause menu.
- Canvas HUD buttons via `hudButtons()` returning home / pause / mute (same positions/sizes as lost-coin), all working by touch.
- Pause menu with **Resume**, **↻ Restart Level** and **All games**. Keys: `P`/`Esc` pause, `R` restart while paused, `M` mute, `Enter`/`Space` press the card button.
- Globals `state` ('title' | 'intro' (optional) | 'play' | 'pause' | 'win' | 'fail' ...), `update`, `render`, `startLevel`. Tapping `#ovBtn` from the title must get to `state === 'play'` (through any intro/story cards).
- iOS hardening exactly like lost-coin: CSS `touch-action:none`, `-webkit-touch-callout:none`, `-webkit-user-select:none`, `overscroll-behavior:none`; JS `preventDefault` on touchstart/touchmove/touchend on the canvas, and on dblclick, contextmenu, gesturestart/gesturechange.
- **Tap-first touch controls** (the parent found "hold" controls too easy). Drags/swipes are fine where they fit the game. Keyboard controls too for computers. Respond on `touchstart`/`pointerdown`, not on `click`.
- Best score in `localStorage` under the key you are given (wrap in try/catch), shown on the title card.
- Levels: at least 5, with a real difficulty ramp. Level 1 easy enough for a 5-year-old; later levels a challenge for a 10-year-old. The player can lose (a fail card with Try Again), and the score rewards skill.
- Short, simple, child-friendly instructions on the title card (bold the key actions). Short on-screen hints the first time something new appears.
- Cartoon style matching the collection: chunky rounded shapes, warm colours, friendly faces with big eyes, Bible-times clothing. Gentle: no blood or gore, no scary imagery for small children. Enemies are shooed away, fall over with cartoon stars, run off, etc. God's help is shown with light/glow, never anything frightening.

## Bible verses (strict)

- `const VERSES = { key: { ref: 'Book C:V', KJV: '…', NKJV: '…', NIV: '…', NLT: '…' }, ... }` and use `Bible.verse(VERSES.key)` (returns `{ text, cite }`) to show them, plus `Bible.credits(VERSES)` as the credit line on the title and win cards — exactly like lost-coin.
- Every entry needs all four versions, quoted WORD FOR WORD from that translation. Get the real text with:
  `node scripts/check-verses.js --show "1 Samuel 17:45" NIV`
  Copy from that output. You may trim with "..." between fragments, but every fragment must be exact (punctuation and capitals don't matter to the checker; words do). Never paraphrase into a quote. Keep each quote short (a phrase to a couple of verses).
- When done, `node scripts/check-verses.js your-game.html` must print `mismatches=0 missing(non-KJV)=0`.
- Typically 4–8 verse entries per game: title card, level cards, win card, fail card.

## Sound

Use music.js exactly like lost-coin (`Music.theme = {...}`, `Music.init` in `sfx.init`, `Music.start/win/fail/tap`, and the `syncAmbience()` helper so ambience plays only during play, unmuted and visible). The family chose the **harp and shepherd's pipe** sound: use `harp` or `pipe` as the instrument and the other (or strings) as the accent. Tunes: hallelujah, joyToTheWorld, oComeAllYeFaithful, amazingGrace, jesusLovesMe, odeToJoy, doxology. Ambience: sea, wind, birds, crowd, night, fire, market, none.

## Testing (required before you report)

1. Smoke test (house rules, play, pause, restart, home button):
   `NODE_PATH=/opt/node-tools/node_modules node build-plan/smoke.js your-game.html yourBestKey` must print `SMOKE OK`.
2. Verse check as above.
3. Your own Playwright script (Chromium is pre-installed: `NODE_PATH=/opt/node-tools/node_modules`, `require('playwright')`; serve the repo root over http or use file://) that plays the game with touch taps and proves: level 1 can be won, every level can be won by a competent scripted player, doing nothing or playing badly loses, and the level/win/fail cards appear.
4. Screenshots at 390×844 (phone) and 1376×1032 and 820×1180 (iPad) of the title card and gameplay of early and late levels. LOOK at them and fix anything that is cut off, overlapping, too small to tap, or ugly.

## Don'ts

- Don't edit `index.html`, `README.md`, `bible.js`, `music.js`, or any other game. Only create your own files. (The menu is updated separately.)
- Don't run any git commands.
- Keep test scripts and screenshots outside the repo, in your own folder under the session's scratchpad or /tmp.

## Report back

For each game: filename, best key, theme, a short description of how it plays and how difficulty ramps, the menu card text (title, short "ref" line like `Five smooth stones · 1 Samuel 17:40`, and a one-sentence description), and the test results (smoke, verses, winnability).

## Addendum: cards on small screens

lost-coin.html now ends its <style> with a `/* card-fit */` rule that keeps `#ovBtn` sticky at the bottom of the card (`position: sticky; bottom: 4px; z-index: 2;`). Keep it in your game, so Begin is always visible when the instructions are long (small phones, iPad mini in landscape). Check your title card at 1133×744 and 375×667 too.
