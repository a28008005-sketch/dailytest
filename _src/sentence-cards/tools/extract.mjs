// usage: node extract.mjs <pdf> <level> <outdir> [firstPage lastPage]
// odd pages -> front images (top/bottom card), even pages -> Q/A text
import fs from 'node:fs';
import path from 'node:path';
import { createCanvas } from '@napi-rs/canvas';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const [pdfPath, level, outDir, fp, lp] = process.argv.slice(2);
const imgDir = path.join(outDir, 'img', level);
fs.mkdirSync(imgDir, { recursive: true });

const fd = fs.openSync(pdfPath, 'r');
const length = fs.fstatSync(fd).size;
class FileRange extends pdfjs.PDFDataRangeTransport {
  requestDataRange(begin, end) {
    const buf = Buffer.alloc(end - begin);
    fs.readSync(fd, buf, 0, end - begin, begin);
    setImmediate(() => this.onDataRange(begin, new Uint8Array(buf.buffer, buf.byteOffset, buf.length)));
  }
}
const range = new FileRange(length, null);
const doc = await pdfjs.getDocument({
  range, length, rangeChunkSize: 1 << 20, disableAutoFetch: true, disableStream: true, verbosity: 0,
}).promise;

const SCALE = 1.4;
// card inner area in PDF points (A4 595x842), y from top
const CARDS = [{ x: 15, y: 15, w: 566, h: 391 }, { x: 15, y: 436, w: 566, h: 391 }];
const H = 842;

const textOut = path.join(outDir, `text_${level}.json`);
const texts = fs.existsSync(textOut) ? JSON.parse(fs.readFileSync(textOut, 'utf8')) : {};
const first = +(fp || 1), last = Math.min(+(lp || doc.numPages), doc.numPages);

for (let p = first; p <= last; p++) {
  const page = await doc.getPage(p);
  const base = (Math.ceil(p / 2) - 1) * 2; // card index base (0-based)
  if (p % 2 === 1) {
    const vp = page.getViewport({ scale: SCALE });
    const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    CARDS.forEach((c, i) => {
      const w = Math.round(c.w * SCALE), h = Math.round(c.h * SCALE);
      const out = createCanvas(w, h);
      out.getContext('2d').drawImage(canvas, Math.round(c.x * SCALE), Math.round(c.y * SCALE), w, h, 0, 0, w, h);
      const no = String(base + i + 1).padStart(3, '0');
      fs.writeFileSync(path.join(imgDir, no + '.webp'), out.encodeSync('webp', 70));
    });
  } else {
    const tc = await page.getTextContent();
    const halves = [[], []];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const yTop = H - it.transform[5];
      halves[yTop < H / 2 ? 0 : 1].push({ s: it.str, x: it.transform[4], y: Math.round(yTop) });
    }
    halves.forEach((items, i) => {
      // group into lines
      items.sort((a, b) => a.y - b.y || a.x - b.x);
      const lines = [];
      for (const it of items) {
        const L = lines.find((l) => Math.abs(l.y - it.y) <= 3);
        if (L) L.parts.push(it); else lines.push({ y: it.y, parts: [it] });
      }
      const txt = lines.map((l) => l.parts.sort((a, b) => a.x - b.x).map((p) => p.s).join('').replace(/\s+/g, ' ').trim());
      const no = String(base + i + 1).padStart(3, '0');
      texts[no] = txt;
    });
  }
  page.cleanup();
  if (p % 20 === 0) process.stdout.write(`${level} p${p}/${last}\r`);
}
fs.writeFileSync(textOut, JSON.stringify(texts, null, 1));
console.log(`\n${level} done pages ${first}-${last} of ${doc.numPages}`);
await doc.destroy();
fs.closeSync(fd);
