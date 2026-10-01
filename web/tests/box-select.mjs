// AutoCAD-style box selection: dragging right = window (only parts fully
// inside), dragging left = crossing (everything the box touches).
// Usage: npm run build && node tests/box-select.mjs [outdir]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const out = process.argv[2] || 'shots'; fs.mkdirSync(out, { recursive: true });
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2300);
await page.evaluate(() => { app.openExample('divider'); app.editor.setRunning(false); }); await page.waitForTimeout(600);
await page.evaluate(() => app.editor.setMulti(true)); await page.waitForTimeout(300);
const cdp = await ctx.newCDPSession(page);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// a box around the first resistor that only clips the source and the meter
const box = await page.evaluate(() => {
  const ed = app.editor, R = ed.renderer, c = ed.canvas.getBoundingClientRect();
  const r1 = ed.doc.elements.find((e) => e.name === 'R1'), [a, b, cc, d] = r1.worldBox();
  const [x1, y1] = R.toScreen(a, b), [x2, y2] = R.toScreen(cc, d);
  return [c.left + x1 - 46, c.top + y1 - 10, c.left + x2 + 10, c.top + y2 + 10];
});
const drag = async (from, to, shot) => {
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from[0], y: from[1] }] });
  for (let i = 1; i <= 12; i++) { await sleep(16); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from[0] + (to[0] - from[0]) * i / 12, y: from[1] + (to[1] - from[1]) * i / 12 }] }); }
  await sleep(100);
  const live = await page.evaluate(() => [...(app.editor.marqueePick?.els || [])].map((e) => e.name).sort().join(','));
  await page.screenshot({ path: path.join(out, shot) });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await sleep(200);
  return { live, picked: await page.evaluate(() => [...app.editor.selection].map((e) => e.name).sort().join(',')) };
};
const win = await drag([box[0], box[1]], [box[2], box[3]], 'window.png');
await page.evaluate(() => app.editor.select(null));
const cross = await drag([box[2], box[3]], [box[0], box[1]], 'crossing.png');
console.log('window   (drag right):', JSON.stringify(win));
console.log('crossing (drag left) :', JSON.stringify(cross));
const ok = win.picked === 'R1' && cross.picked.split(',').length > 1 && cross.picked.includes('R1') && win.live === win.picked && cross.live === cross.picked;
console.log(errs.length ? errs : 'no page errors', ok ? 'PASS' : 'FAIL');
await browser.close(); server.close();
