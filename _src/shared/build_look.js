// 보카 옷장(WEARS)을 게임에서 쓰는 shared/wear-data.js로 옮긴다. 보카에서 아이템을 고치면 다시 실행.
// 실행: node _src/shared/build_look.js (저장소 루트)
const fs = require('fs');
const s = fs.readFileSync('voca/index.html', 'utf8');
const a = s.indexOf('var WEARS = ['), b = s.indexOf('];', a);
const WEARS = eval(s.slice(a + 'var WEARS = '.length, b + 1));
const keep = WEARS.filter((w) => w.img).map((w) => { const o = {}; ['id', 'slot', 'name', 'img', 'ar', 'iw', 'ih', 'by', 'cy', 'cx', 'rot'].forEach((k) => { if (w[k] != null) o[k] = w[k]; }); return o; });
fs.writeFileSync('shared/wear-data.js', '// 자동 생성: _src/shared/build_look.js (보카 옷장 아이템 자리)\nwindow.WEAR_DATA=' + JSON.stringify(keep) + ';\n');
console.log(keep.length, 'items');
