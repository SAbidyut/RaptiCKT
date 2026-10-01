// Close-up visual audit: every component at 2x zoom (rotation 0 and 1), for
// spotting text that overlaps its own symbol. Usage: npm run build && node tests/zoom-audit.mjs <outdir> [--cats=..] [--only=..]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const out = process.argv[2] || 'zoom'; fs.mkdirSync(out, { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1200, height: 1500 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(1800);
const cats = (process.argv.find((a) => a.startsWith('--cats=')) || '').slice(7).split(',').filter(Boolean);
const only = (process.argv.find((a) => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
let ids = await page.evaluate((cats) => app.categories.filter((c) => !cats.length || cats.includes(c.id)).flatMap((c) => c.items), cats);
if (only.length) ids = ids.filter((t) => only.includes(t));
const per = 12; let n = 0;
for (let i = 0; i < ids.length; i += per) {
  const chunk = ids.slice(i, i + per);
  await page.evaluate((chunk) => {
    const ed = app.editor; ed.close();
    const doc = ed.newDoc('zoom');
    const C = 8 * 20;
    chunk.forEach((t, r) => {
      for (let k = 0; k < 2; k++) {
        const e = ed.makeEl(t, (k * 2 + (r % 2)) * C + C / 2, Math.floor(r / 2) * C + C / 2);
        e.rot = k; doc.elements.push(e);
      }
    });
    app.settings.showNames = true; app.settings.showValues = true;
    app.show('editor'); ed.open(doc); ed.toggleScope(false);
    const R = ed.renderer; R.scale = 1.8; R.ox = 10; R.oy = 10; ed.dirtyDraw = true;
  }, chunk);
  await page.waitForTimeout(350);
  await (await page.$('.board')).screenshot({ path: path.join(out, `z-${String(++n).padStart(2, '0')}.png`) });
  console.log(n, chunk.join(','));
}
await browser.close(); server.close();
