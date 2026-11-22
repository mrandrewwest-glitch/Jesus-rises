// Checks every Bible quotation in the games word for word against BibleGateway.
//
//   node scripts/check-verses.js                 check every game
//   node scripts/check-verses.js david-goliath.html moses-basket.html
//   node scripts/check-verses.js --show "1 Samuel 17:45" NIV   print a passage
//
// Each game has `const VERSES = { key: { ref, KJV, NKJV, NIV, NLT }, ... }`.
// A quote may leave words out with "..." (or "…"); each piece must appear in the passage.
// Passages are cached in scripts/.verse-cache.json (not committed).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const https = require('https');

const root = path.join(__dirname, '..');
const cacheFile = path.join(__dirname, '.verse-cache.json');
const cache = fs.existsSync(cacheFile) ? JSON.parse(fs.readFileSync(cacheFile, 'utf8')) : {};
const VERSIONS = ['KJV', 'NKJV', 'NIV', 'NLT'];

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (verse checker)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(new URL(res.headers.location, url).toString()));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => (body += c));
      res.on('end', () => (res.statusCode === 200 ? resolve(body) : reject(new Error(`HTTP ${res.statusCode} for ${url}`))));
    }).on('error', reject);
  });
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', mdash: '—', ndash: '–', hellip: '…' };
function decode(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}

function passageText(html) {
  const blocks = [];
  const re = /<div class="passage-text">([\s\S]*?)<div class="footnotes">|<div class="passage-text">([\s\S]*?)<div class="passage-other-trans">/g;
  let m;
  while ((m = re.exec(html))) blocks.push(m[1] || m[2]);
  if (!blocks.length) {
    const i = html.indexOf('<div class="passage-text">');
    if (i < 0) return '';
    blocks.push(html.slice(i, i + 200000));
  }
  return blocks
    .map((b) =>
      b
        .replace(/<sup[^>]*class="[^"]*(footnote|crossreference)[^"]*"[^>]*>[\s\S]*?<\/sup>/g, '')
        .replace(/<sup[^>]*class="versenum[^"]*"[^>]*>[\s\S]*?<\/sup>/g, ' ')
        .replace(/<span class="chapternum">[\s\S]*?<\/span>/g, ' ')
        .replace(/<h[1-6][\s\S]*?<\/h[1-6]>/g, ' ')
        .replace(/<div class="(crossrefs|footnotes|publisher-info|dropdowns|passage-scroller)[\s\S]*$/g, '')
        .replace(/<\/?(span|i|em|b|strong|small)\b[^>]*>/g, '')
        .replace(/<[^>]+>/g, ' ')
    )
    .map(decode)
    .join(' ')
    .replace(/Read full chapter[\s\S]*$/, '')
    .replace(/\(\s*[A-Z]{1,3}\s*\)/g, ' ')
    .replace(/\[\s*[a-z]{1,3}\s*\]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPassage(ref, version) {
  const key = `${version}|${ref}`;
  if (cache[key]) return cache[key];
  const url = `https://www.biblegateway.com/passage/?search=${encodeURIComponent(ref)}&version=${version}&interface=print`;
  const text = passageText(await get(url));
  if (!text) throw new Error(`no passage text for ${ref} (${version})`);
  cache[key] = text;
  fs.writeFileSync(cacheFile, JSON.stringify(cache, null, 1));
  await new Promise((r) => setTimeout(r, 300));
  return text;
}

// Compare on words only: case, punctuation, quote marks and dashes don't matter.
function norm(s) {
  return ' ' + s
    .replace(/\(\s*[A-Z]{1,3}\s*\)/g, ' ')
    .replace(/\[\s*[a-z]{1,3}\s*\]/g, ' ')
    .toLowerCase()
    .replace(/[’‘`´]/g, "'")
    .replace(/[—–-]/g, ' ')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/(^|\s)'+|'+(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() + ' ';
}

function versesOf(file) {
  const src = fs.readFileSync(file, 'utf8');
  const start = src.indexOf('const VERSES');
  if (start < 0) return null;
  let i = src.indexOf('{', start), depth = 0, j = i, str = null;
  for (; j < src.length; j++) {
    const c = src[j];
    if (str) { if (c === '\\') j++; else if (c === str) str = null; continue; }
    if (c === '/' && src[j + 1] === '/') { j = src.indexOf('\n', j); continue; }
    if (c === '/' && src[j + 1] === '*') { j = src.indexOf('*/', j) + 1; continue; }
    if (c === '"' || c === "'" || c === '`') str = c;
    else if (c === '{') depth++;
    else if (c === '}' && --depth === 0) break;
  }
  return vm.runInNewContext('(' + src.slice(i, j + 1) + ')');
}

async function main() {
  const args = process.argv.slice(2);
  if (args[0] === '--show') {
    console.log(await fetchPassage(args[1], args[2] || 'KJV'));
    return;
  }
  const files = args.length ? args : fs.readdirSync(root).filter((f) => f.endsWith('.html')).map((f) => f);
  let ok = 0, bad = 0, missing = 0;
  for (const f of files) {
    const verses = versesOf(path.resolve(root, f));
    if (!verses) continue;
    for (const [key, e] of Object.entries(verses)) {
      for (const v of VERSIONS) {
        if (!e[v]) { if (v !== 'KJV') missing++; console.log(`MISSING ${f} ${key} ${v}`); continue; }
        let text;
        try { text = norm(await fetchPassage(e.ref, v)); } catch (err) { bad++; console.log(`ERROR ${f} ${key} ${v}: ${err.message}`); continue; }
        const pieces = e[v].split(/\.\.\.|…/).map(norm).filter((p) => p.trim());
        const wrong = pieces.filter((p) => !text.includes(p));
        if (wrong.length) { bad++; console.log(`MISMATCH ${f} ${key} ${v} (${e.ref}): "${wrong.map((w) => w.trim()).join('" / "')}"`); }
        else ok++;
      }
    }
  }
  console.log(`checked ok=${ok} mismatches=${bad} missing(non-KJV)=${missing}`);
  process.exit(bad ? 1 : 0);
}
main().catch((e) => { console.error(e); process.exit(2); });
