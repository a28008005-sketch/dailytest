// html/*.html → pdf/*.pdf (Chromium 인쇄)
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
(async () => {
  const W = process.argv[2], only = process.argv[3];
  fs.mkdirSync(W + '/pdf', { recursive: true });
  const b = await chromium.launch();
  const p = await b.newPage();
  for (const f of fs.readdirSync(W + '/html').filter((f) => f.endsWith('.html') && (!only || f.startsWith(only))).sort()) {
    await p.goto('file://' + path.resolve(W, 'html', f), { waitUntil: 'networkidle' });
    await p.evaluate(() => document.fonts.ready);
    await p.evaluate(() => Promise.all([...document.images].map((i) => i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }))));
    await p.emulateMedia({ media: 'print' });
    await p.evaluate(() => window.__fit());
    await p.pdf({ path: W + '/pdf/' + f.replace('.html', '.pdf'), preferCSSPageSize: true, printBackground: true, tagged: true });
    console.log(f);
  }
  await b.close();
})();
