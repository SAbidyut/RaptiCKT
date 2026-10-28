// Touch-drags parts again and again in running examples. Dragging selects a part, which opens the
// value knob over the lower right of the board: a part dropped there must still be picked up again
// (the knob's label lets touches through and the board slides the part clear of the dial).
// Usage: npm run build && node tests/knob-drag.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true, fsTip2: true, tapWireHelp: true, noOverlapTip: true })));
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
const cdp = await ctx.newCDPSession(page);
await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2000);
let fail = 0;
const check = (ok, what) => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${what}`); if (!ok) fail++; };
const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
const pos = (n) => page.evaluate((n) => { const e = app.editor.doc.elements.find((x) => x.name === n); return [e.x, e.y]; }, n);
const scr = (x, y) => page.evaluate(([x, y]) => { const r = app.editor.canvas.getBoundingClientRect(); const [sx, sy] = app.editor.renderer.toScreen(x, y); return [sx + r.left, sy + r.top]; }, [x, y]);
const drag = async (n, dx, dy) => {
  const p0 = await pos(n), a = await scr(...p0);
  await touch('touchStart', a[0], a[1]);
  for (let i = 1; i <= 20; i++) { await touch('touchMove', a[0] + dx * i / 20, a[1] + dy * i / 20); await page.waitForTimeout(16); }
  await touch('touchEnd'); await page.waitForTimeout(450);
  const p1 = await pos(n);
  return [p0, p1];
};
// each part goes down and to the right, into the knob's corner, three times over
for (const [ex, parts] of [['ceamp', ['R5', 'C1', 'V1']], ['housewiring', ['LP1']]]) {
  await page.evaluate((id) => { app.goHome(); app.openExample(id); }, ex); await page.waitForTimeout(1200);
  for (const n of parts) {
    for (let r = 0; r < 3; r++) {
      const [p0, p1] = await drag(n, r % 2 ? -50 : 50, 30);
      check(p0[0] !== p1[0] || p0[1] !== p1[1], `${ex}: ${n} drag ${r + 1} moves it (${p0} → ${p1})`);
    }
  }
}
check(!errs.length, `no page errors ${errs.join(' | ')}`);
await browser.close(); server.close();
if (fail) { console.log(`FAIL (${fail})`); process.exit(1); }
console.log('all ok');
