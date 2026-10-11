import fs from 'node:fs';
import { analyze, show, setOverrides } from './analyze.mjs';
globalThis.window = {};
eval(fs.readFileSync('../site/cards.js', 'utf8'));
const fixes = JSON.parse(fs.readFileSync('parse_fixes.json', 'utf8')).sentences;
setOverrides(fixes);
const all = new Set();
const out = [];
for (const L of window.CARD_DATA.levels) for (const c of L.cards) { all.add(c.a); out.push(`${L.id}-${c.no} ${show(analyze(c.a))}`); }
const norm = (s) => s.replace(/\s+/g, '');
for (const [k, v] of Object.entries(fixes)) {
  if (!all.has(k)) console.log('NO CARD:', k);
  const joined = v.split(' | ').map((p) => p.slice(p.indexOf(':') + 1)).join(' ');
  if (norm(joined) !== norm(k)) console.log('TEXT MISMATCH:', k, '=>', joined);
}
fs.writeFileSync('../work/parse_review.txt', out.join('\n'));
console.log(out.length);
