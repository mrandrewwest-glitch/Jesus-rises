// Copies the web games into www/, the folder Capacitor packs into the iOS and Android apps.
// Run with: npm run build
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

// The app gets the menu and every game the menu links to. Games still being built
// (in the repo but not on the menu yet) and the website-only pages stay out.
const menu = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pages = new Set(['index.html', ...[...menu.matchAll(/<a class="game" href="([^"#?]+\.html)"/g)].map((m) => m[1])]);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

let count = 0;
for (const name of fs.readdirSync(root)) {
  if (pages.has(name) || (name.endsWith('.js') && !name.includes('config'))) {
    fs.copyFileSync(path.join(root, name), path.join(out, name));
    count++;
  }
}
fs.cpSync(path.join(root, 'fonts'), path.join(out, 'fonts'), { recursive: true });

// Every link between pages must point at a file that was copied.
const missing = [];
for (const name of fs.readdirSync(out).filter((n) => n.endsWith('.html'))) {
  const html = fs.readFileSync(path.join(out, name), 'utf8');
  for (const [, href] of html.matchAll(/(?:href|src)="([^"#:?${}]+)"/g)) {
    if (!fs.existsSync(path.join(out, href))) missing.push(`${name} -> ${href}`);
  }
}
if (missing.length) {
  console.error('Missing files:\n  ' + missing.join('\n  '));
  process.exit(1);
}
console.log(`Copied ${count} files and fonts/ into www/`);
