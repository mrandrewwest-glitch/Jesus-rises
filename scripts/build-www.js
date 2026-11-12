// Copies the web games into www/, the folder Capacitor packs into the iOS and Android apps.
// Run with: npm run build
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const out = path.join(root, 'www');

// Pages that are for the website only (App Store support and privacy pages) stay out of the app.
const WEB_ONLY = new Set(['privacy.html', 'support.html']);

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

let count = 0;
for (const name of fs.readdirSync(root)) {
  if ((name.endsWith('.html') && !WEB_ONLY.has(name)) || name.endsWith('.js') && !name.includes('config')) {
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
