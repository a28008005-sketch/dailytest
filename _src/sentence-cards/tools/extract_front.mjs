// 카드 앞면(홀수 쪽)의 한글 문장만 뽑습니다.  node extract_front.mjs <pdf> <레벨> <work폴더>
//   → work/front_<레벨>.json  { "001": "그것은 무엇이니?", ... }
import fs from 'node:fs';
import path from 'node:path';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [pdfPath, level, outDir] = process.argv.slice(2);
const fd = fs.openSync(pdfPath, 'r');
const length = fs.fstatSync(fd).size;
class FileRange extends pdfjs.PDFDataRangeTransport {
  requestDataRange(b, e) {
    const buf = Buffer.alloc(e - b); fs.readSync(fd, buf, 0, e - b, b);
    setImmediate(() => this.onDataRange(b, new Uint8Array(buf.buffer, buf.byteOffset, buf.length)));
  }
}
const doc = await pdfjs.getDocument({ range: new FileRange(length, null), length, rangeChunkSize: 1 << 20, disableAutoFetch: true, disableStream: true, verbosity: 0 }).promise;
const out = {};
for (let p = 1; p <= doc.numPages; p += 2) {
  const page = await doc.getPage(p);
  const items = (await page.getTextContent()).items
    .filter((x) => /[가-힣]/.test(x.str))
    .map((x) => ({ s: x.str.trim(), y: 842 - x.transform[5], x: x.transform[4] }));
  const base = p - 1; // 앞면 p 쪽 = 카드 p, p+1
  [0, 1].forEach((half) => {
    const mine = items.filter((it) => (half === 0 ? it.y < 421 : it.y >= 421)).sort((a, b) => a.y - b.y || a.x - b.x);
    out[String(base + half + 1).padStart(3, '0')] = mine.map((it) => it.s).join(' ').replace(/\s+/g, ' ').trim();
  });
  page.cleanup();
}
fs.writeFileSync(path.join(outDir, `front_${level}.json`), JSON.stringify(out, null, 1));
console.log(level, Object.keys(out).length, '장');
