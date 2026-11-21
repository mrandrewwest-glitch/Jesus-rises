// Smoke test for one game: node smoke.js <file.html> <bestKey>
// Serves the repo root, opens the game on a phone-sized touch screen and checks the house rules.
const { chromium } = require('playwright');
const http = require('http'); const fs = require('fs'); const path = require('path');
const root = '/home/user/Jesus-rises';
const [file, key] = process.argv.slice(2);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
const port = 9000 + Math.floor(Math.random() * 900);
const srv = http.createServer((q, r) => { const f = path.join(root, decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r); }).listen(port);
(async () => {
  const src = fs.readFileSync(path.join(root, file), 'utf8');
  const res = { file, errs: [], problems: [] };
  const need = (cond, msg) => { if (!cond) res.problems.push(msg); };
  need(src.includes('<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">'), 'viewport meta must be exactly the house one');
  need(src.includes('<link href="fonts/fonts.css" rel="stylesheet">'), 'must link fonts/fonts.css (no Google Fonts)');
  need(!/https?:\/\//.test(src.replace(/<!--[\s\S]*?-->/g, '').replace(/\/\/[^\n]*/g, '')), 'no external URLs allowed (the app must work offline)');
  need(src.includes('<script src="bible.js"></script>') && src.includes('<script src="music.js"></script>'), 'must load bible.js and music.js');
  need(src.includes('const VERSES'), 'needs a VERSES table');
  need(src.includes(`'${key}'`), `must save its best score under localStorage key '${key}'`);
  need(/href="index\.html"/.test(src), 'needs an All games link to index.html');
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
  await ctx.route(/^https?:\/\/(?!localhost)/, (r) => r.abort());
  const p = await ctx.newPage();
  p.on('pageerror', (e) => res.errs.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error' && !/Ignored attempt to cancel a touch/.test(m.text())) res.errs.push('console: ' + m.text()); });
  await p.goto(`http://localhost:${port}/${file}`, { waitUntil: 'load' });
  await p.waitForTimeout(600);
  res.touchAction = await p.evaluate(() => getComputedStyle(document.querySelector('canvas') || document.body).touchAction);
  need(res.touchAction === 'none', 'canvas needs touch-action: none');
  for (let k = 0; k < 20; k++) {
    const st = await p.evaluate(() => typeof state !== 'undefined' ? state : null);
    if (st === 'play') break;
    const box = await p.evaluate(() => { const b = document.getElementById('ovBtn'); if (!b) return null; const r = b.getBoundingClientRect(); if (!r.width) return null; const t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return t === b || b.contains(t) ? { x: r.x + r.width / 2, y: r.y + r.height / 2 } : null; });
    if (box) await p.touchscreen.tap(box.x, box.y); else await p.touchscreen.tap(195, 500);
    await p.waitForTimeout(600);
  }
  res.stateAfterTaps = await p.evaluate(() => typeof state !== 'undefined' ? state : null);
  need(res.stateAfterTaps === 'play', 'tapping Begin / the screen should reach state "play"');
  // Play a little with random taps so update/render run in many situations.
  for (let k = 0; k < 25; k++) { await p.touchscreen.tap(40 + Math.random() * 310, 200 + Math.random() * 600); await p.waitForTimeout(120); }
  await p.waitForTimeout(1500);
  res.stateAfterPlaying = await p.evaluate(() => state);
  // If the random taps lost the level, start it again so pause can be tested.
  if (res.stateAfterPlaying !== 'play') { await p.evaluate(() => startLevel()); await p.waitForTimeout(800); }
  await p.keyboard.press('KeyP'); await p.waitForTimeout(300);
  res.paused = await p.evaluate(() => state);
  need(res.paused === 'pause', 'P should pause (state "pause")');
  res.restartButton = await p.evaluate(() => [...document.querySelectorAll('button')].some((x) => /restart/i.test(x.textContent) && x.offsetParent));
  need(res.restartButton, 'pause menu needs a visible Restart Level button');
  await p.keyboard.press('KeyR'); await p.waitForTimeout(500);
  res.afterR = await p.evaluate(() => state);
  need(['play', 'intro'].includes(res.afterR), 'R in the pause menu should restart the level');
  const home = await p.evaluate(() => { if (typeof hudButtons !== 'function') return null; const h = hudButtons().find((x) => x.icon === 'home'); return h ? { x: h.x, y: h.y } : null; });
  need(home, 'hudButtons() should include a home button');
  // Tap where the home button is drawn (view coordinates -> CSS pixels).
  if (home) {
    const pos = await p.evaluate((h) => ({ x: (h.x + (typeof offX !== 'undefined' && h.x > 200 ? 0 : 0)) * scale / dpr, y: h.y * scale / dpr }), home);
    await p.touchscreen.tap(pos.x, pos.y);
    await p.waitForTimeout(3000);
    res.afterHome = p.url().split('/').pop();
    need(res.afterHome === 'index.html', `tapping the home button at (${Math.round(pos.x)},${Math.round(pos.y)}) should go to index.html`);
  }
  need(!res.errs.length, 'no page errors');
  await b.close(); srv.close();
  console.log(JSON.stringify(res, null, 1));
  console.log(res.problems.length ? 'SMOKE FAIL' : 'SMOKE OK');
  process.exit(res.problems.length ? 1 : 0);
})();
