// 저학년 게임 체험판(몬스터 잡기) 데이터를 만듭니다.  node tools/build_game.mjs
//   → 공개용/game/data.js  +  pic/<키>.jpg  +  audio/<키>.mp3
// 파닉스·240·520 의 일차별 단어만 담습니다. 그림은 그림/index.json, 음원은 음원/_조각(sha1(en) 앞 16자).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, '공개용', 'game');
const LEVELS = ['lv240']; // 우선 240 레벨만 (파닉스·520 은 나중에)

const db = JSON.parse(fs.readFileSync(path.join(ROOT, 'words_db.json'), 'utf8'));
const pics = JSON.parse(fs.readFileSync(path.join(ROOT, '그림', 'index.json'), 'utf8')).items;
const sha = (t) => crypto.createHash('sha1').update(t).digest('hex').slice(0, 16);

fs.mkdirSync(path.join(OUT, 'pic'), { recursive: true });
fs.mkdirSync(path.join(OUT, 'audio'), { recursive: true });

let nPic = 0, nAud = 0, missAud = 0;
const out = { levels: [] };
for (const id of LEVELS) {
  const L = db.levels.find((l) => l.id === id);
  const level = { id, title: L.title, short: L.short, days: [] };
  for (const d of L.days) {
    const seen = new Set();
    const words = [];
    for (const it of d.items) {
      if (it.kind !== 'word' || seen.has(it.en.toLowerCase())) continue;
      seen.add(it.en.toLowerCase());
      const w = { en: it.en, ko: it.ko || '' };
      const pic = (pics[d.id] || {})['word|' + it.en.toLowerCase()];
      if (pic && fs.existsSync(path.join(ROOT, '그림', pic))) {
        const key = sha('pic:' + pic);
        const dst = path.join(OUT, 'pic', key + '.jpg');
        if (!fs.existsSync(dst)) { fs.copyFileSync(path.join(ROOT, '그림', pic), dst); nPic++; }
        w.p = key;
      }
      const clip = path.join(ROOT, '음원', '_조각', sha(it.en) + '.mp3');
      if (fs.existsSync(clip)) {
        const dst = path.join(OUT, 'audio', sha(it.en) + '.mp3');
        if (!fs.existsSync(dst)) { fs.copyFileSync(clip, dst); nAud++; }
        w.a = sha(it.en);
      } else missAud++;
      words.push(w);
    }
    if (words.length) level.days.push({ id: d.id, label: d.label, words });
  }
  out.levels.push(level);
}
fs.writeFileSync(path.join(OUT, 'data.js'), 'window.GAME_DATA = ' + JSON.stringify(out) + ';\n');
const mb = (dir) => fs.readdirSync(dir).reduce((n, f) => n + fs.statSync(path.join(dir, f)).size, 0) / 1048576;
console.log(`그림 ${nPic}개 새로 · 음원 ${nAud}개 새로 · 음원 없음 ${missAud}`);
console.log(`pic ${mb(path.join(OUT, 'pic')).toFixed(1)}MB · audio ${mb(path.join(OUT, 'audio')).toFixed(1)}MB · data ${(fs.statSync(path.join(OUT, 'data.js')).size / 1024).toFixed(0)}KB`);
