// Visual audit: renders every component in rotations 0–3 plus flipped, with names
// and values, so overlaps and misalignments can be inspected.
// Usage: npm run build && node tests/audit.mjs <outdir> [--run]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const out = process.argv[2] || 'audit';
const running = process.argv.includes('--run');
fs.mkdirSync(out, { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1180, height: 1720 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForTimeout(1800);
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const cats = (process.argv.find((a) => a.startsWith('--cats=')) || '').slice(7).split(',').filter(Boolean);
const chunks = await page.evaluate(({ only, cats }) => {
  const P = app.editor.palette, ids = [];
  for (const t of app.categories.map((c) => c.id)) {
    if (cats.length && !cats.includes(t)) continue;
    P.tab = t; P.query = '';
    for (const C of P.items()) if (!ids.includes(C.type) && (!only.length || only.includes(C.type))) ids.push(C.type);
  }
  const res = [];
  for (let i = 0; i < ids.length; i += 7) res.push(ids.slice(i, i + 7));
  return res;
}, { only, cats });
let n = 0;
for (const chunk of chunks) {
  await page.evaluate(({ chunk, running }) => {
    const ed = app.editor;
    ed.close();
    const doc = ed.newDoc('audit');
    const C = 11 * 20;
    chunk.forEach((t, r) => {
      for (let k = 0; k < 5; k++) {
        const e = ed.makeEl(t, k * C + C / 2, r * C + C / 2);
        e.rot = k % 4; e.flip = k === 4;
        doc.elements.push(e);
      }
    });
    app.settings.showNames = true; app.settings.showValues = true;
    app.show('editor');
    ed.open(doc);
    if (running) ed.setRunning(true);
    ed.toggleScope(false);
    const R = ed.renderer;
    R.scale = 1; R.ox = 20; R.oy = 10;
    ed.dirtyDraw = true;
  }, { chunk, running });
  await page.waitForTimeout(running ? 1000 : 400);
  await (await page.$('.board')).screenshot({ path: path.join(out, `audit-${String(++n).padStart(2, '0')}.png`) });
}
console.log('chunks', n, chunks.map((c) => c.join(',')).join('\n'));
await browser.close(); server.close();
