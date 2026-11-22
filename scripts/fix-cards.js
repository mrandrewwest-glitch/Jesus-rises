// When a game's overlay card is taller than the screen (small phones, phones on their
// side, iPad mini in landscape) the card scrolls, but children didn't know to scroll
// down to find Begin. This keeps the main button stuck to the bottom of the card so
// Begin / Next is always visible,.
// Safe to run more than once: node scripts/fix-cards.js [files...]
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const MARK = '/* card-fit */';
const CSS = `  ${MARK}
  #ovBtn { position: sticky; bottom: 4px; z-index: 2; }
`;
const files = process.argv.slice(2).length ? process.argv.slice(2)
  : fs.readdirSync(root).filter((f) => f.endsWith('.html') && !['index.html', 'privacy.html', 'support.html'].includes(f));
let changed = 0;
for (const f of files) {
  const p = path.resolve(root, f);
  let s = fs.readFileSync(p, 'utf8');
  if (s.includes(MARK) || !s.includes('id="overlay"')) continue;
  const i = s.indexOf('</style>');
  if (i < 0) continue;
  s = s.slice(0, i) + CSS + s.slice(i);
  fs.writeFileSync(p, s);
  changed++;
}
console.log(`card fix added to ${changed} file(s)`);
