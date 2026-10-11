// 추출 결과(work/) → 앱 폴더(site/)
//   node tools/build.mjs            데이터·그림·음원 전부
//   node tools/build.mjs --no-audio 음원 받기를 건너뜀(이미 받은 것은 그대로 씀)
//
// 카드 그림·Q&A 글자는 tools/extract.mjs 가 PDF 에서 뽑아 work/ 에 둡니다.
// 음원은 고래 보카에서 받아 둔 조각(daily test/음원/_조각)을 먼저 쓰고, 없는 것만 새로 받습니다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { loadImage, createCanvas } from '@napi-rs/canvas';
import { analyze, setOverrides } from './analyze.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const WORK = process.env.WORK || path.join(ROOT, 'work');
const SITE = path.join(ROOT, 'site');
const OLD_CLIPS = 'C:/Users/WooJin/Desktop/daily test/음원/_조각';
const LEVELS = ['240', '520', '860', '1240', '1680'];
const noAudio = process.argv.includes('--no-audio');
// 해답지에서 만든 일차별 문장 (고래 보카 데이터)
const DAYS = JSON.parse(fs.readFileSync('C:/Users/WooJin/Desktop/daily test/words_db.json', 'utf8')).levels;
const FIXES = JSON.parse(fs.readFileSync(path.join(HERE, 'fixes.json'), 'utf8')).cards;
setOverrides(JSON.parse(fs.readFileSync(path.join(HERE, 'parse_fixes.json'), 'utf8')).sentences);

const sha = (t) => crypto.createHash('sha1').update(t).digest('hex').slice(0, 16);
const clean = (s) => s.replace(/([A-Za-z])- ([A-Za-z])/g, '$1-$2').replace(/,(?=[A-Za-z])/g, ', ').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim();
const hasLatin = (s) => /[A-Za-z]{2,}/.test(s);

// ── Q/A 글자 ─────────────────────────────────────────────
function parseBack(lines) {
  let mode = null; const q = [], a = [];
  for (const raw of lines) {
    const l = raw.trim();
    if (/^(\d{3})+$/.test(l) ||/^Sent[a-z]* ?Bank/i.test(l)) { mode = null; continue; }
    let m;
    if ((m = l.match(/^Q\s*:\s*(.*)$/))) { mode = 'q'; if (m[1]) q.push(m[1]); continue; }
    if ((m = l.match(/^A\s*:\s*(.*)$/))) { mode = 'a'; if (m[1]) a.push(m[1]); continue; }
    if (mode === 'q') q.push(l); else if (mode === 'a') a.push(l);
  }
  return { q: clean(q.join(' ')), a: clean(a.join(' ')) };
}

// ── 레벨 색: 카드 번호 배지 픽셀 ──────────────────────────
async function badgeColor(file) {
  const img = await loadImage(fs.readFileSync(file));
  const c = createCanvas(img.width, img.height);
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(52, 440, 8, 8).data;
  let r = 0, g = 0, b = 0; for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  const n = d.length / 4, hx = (v) => Math.round(v / n).toString(16).padStart(2, '0');
  return '#' + hx(r) + hx(g) + hx(b);
}

// ── 음원 ────────────────────────────────────────────────
const AUD = path.join(SITE, 'audio');
fs.mkdirSync(AUD, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let fetched = 0, reused = 0, missing = 0;
async function clip(text, lang) {
  const key = lang === 'en' ? sha(text) : sha('ko:' + text);
  const out = path.join(AUD, key + '.mp3');
  if (fs.existsSync(out) && fs.statSync(out).size > 800) return key;
  const old = path.join(OLD_CLIPS, key + '.mp3');
  if (lang === 'en' && fs.existsSync(old) && fs.statSync(old).size > 800) { fs.copyFileSync(old, out); reused++; return key; }
  if (noAudio) { missing++; return null; }
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${lang}&q=` + encodeURIComponent(text);
  let wait = 1200;
  for (let t = 1; t <= 5; t++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!res.ok) throw new Error('응답 ' + res.status);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 800 || buf[0] !== 0xff) throw new Error('mp3 아님');
      fs.writeFileSync(out, buf); fetched++;
      await sleep(350);
      return key;
    } catch (e) {
      if (t === 5) { console.error('\n음원 실패:', text, e.message); missing++; return null; }
      await sleep(wait); wait *= 2;
    }
  }
}

// ── 조립 ────────────────────────────────────────────────
const data = { levels: [] };
const problems = [];
for (const lv of LEVELS.filter((l) => fs.existsSync(path.join(WORK, `text_${l}.json`)))) {
  const texts = JSON.parse(fs.readFileSync(path.join(WORK, `text_${lv}.json`), 'utf8'));
  // 앞면 한글 (tools/extract_front.mjs)
  const fronts = JSON.parse(fs.readFileSync(path.join(WORK, `front_${lv}.json`), 'utf8'));
  const nos = Object.keys(texts).sort();
  const perUnit = nos.length / 24; // 6권 × 4단원, 단원마다 같은 장수
  const cards = [];
  for (const no of nos) {
    const fix = FIXES[`${lv}-${no}`] || {};
    let { q, a } = parseBack(texts[no]);
    if (fix.q) q = fix.q;
    if (fix.a) a = fix.a;
    if (!q || !a || !hasLatin(a)) problems.push(`${lv}-${no}: ${JSON.stringify(texts[no])}`);
    const qLang = hasLatin(q) ? 'en' : 'ko';
    const i = Number(no) - 1;
    const vol = Math.floor(i / (perUnit * 4)) + 1;
    const unit = Math.floor((i % (perUnit * 4)) / perUnit) + 1;
    // 문장 성분 덩어리: [글자, 역할, 앞말에 붙임]
    const p = analyze(a).map((c) => (c.g ? [c.t, c.r, 1] : [c.t, c.r]));
    cards.push({ no, q, qLang, a, ko: fix.ko || fronts[no] || '', p, vol, unit });
  }
  // 그 단원 안에서 몇 일차(Day)에 나오는 문장인지 — 해답지에서 처음 나오는 날. 못 찾으면 앞 카드와 같은 날.
  {
    const D = DAYS.find((l) => l.short === lv).days;
    const nk = (s) => s.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '');
    let last = 1, lastUnit = '';
    for (const c of cards) {
      const u = c.vol + '-' + c.unit;
      if (u !== lastUnit) { last = 1; lastUnit = u; }
      const hit = D.find((d) => d.id.includes(`-V${c.vol}U${c.unit}D`) && d.items.some((it) => it.kind === 'sent' && nk(it.en) === nk(c.a)));
      c.d = hit ? Number(hit.id.split('D').pop()) : last;
      last = c.d;
    }
  }
  const src = path.join(WORK, 'img', lv);
  const dst = path.join(SITE, 'img', lv);
  fs.mkdirSync(dst, { recursive: true });
  for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  const color = await badgeColor(path.join(src, '001.webp'));
  let done = 0;
  for (const c of cards) {
    c.qa = await clip(c.q, c.qLang);
    c.aa = await clip(c.a, 'en');
    if (++done % 20 === 0) process.stdout.write(`\r${lv} 음원 ${done}/${cards.length}  새로 ${fetched} · 재사용 ${reused}   `);
  }
  data.levels.push({ id: lv, color, perUnit, cards });
  console.log(`\n${lv}: ${cards.length}장 · 단원당 ${perUnit}장 · 색 ${color}`);
}

fs.writeFileSync(path.join(SITE, 'cards.js'), 'window.CARD_DATA = ' + JSON.stringify(data) + ';\n');
fs.writeFileSync(path.join(WORK, 'problems.txt'), problems.join('\n'));
// 카드에서 더는 쓰지 않는 음원은 지웁니다(문장을 고치면 옛 조각이 남으므로).
const used = new Set(data.levels.flatMap((l) => l.cards.flatMap((c) => [c.qa, c.aa])).filter(Boolean).map((k) => k + '.mp3'));
let removed = 0;
if (data.levels.length === LEVELS.length) for (const f of fs.readdirSync(AUD)) if (!used.has(f)) { fs.unlinkSync(path.join(AUD, f)); removed++; }
console.log(`안 쓰는 음원 ${removed}개 정리`);
console.log(`음원: 새로 ${fetched} · 재사용 ${reused} · 빠짐 ${missing}`);
console.log(`확인할 카드 ${problems.length}개 → work/problems.txt`);
