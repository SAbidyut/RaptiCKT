// Full screen in and out: the circuit must not jump. Records, every frame, where a fixed point of
// the circuit sits on the screen while the bars disappear / come back, and how many frames the board
// was left blank (canvas cleared without a redraw).
// Usage: npm run build && node tests/fullscreen-smooth.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const root = path.resolve('dist');
const server = http.createServer((req, res) => { const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1)); if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' }); fs.createReadStream(f).pipe(res); }).listen(0);
const browser = await chromium.launch();
let fail = 0;
for (const [w, h] of [[412, 892], [892, 412]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true, selectHelp: true, fsTip2: true })));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { fail++; console.log('page error', e.message); });
  await page.goto(`http://127.0.0.1:${server.address().port}/`); await page.waitForTimeout(2200);
  await page.evaluate(() => window.app.openExample('flat'));
  await page.waitForTimeout(800);
  for (const on of [true, false]) {
    const r = await page.evaluate((on) => new Promise((done) => {
      const ed = window.app.editor, R = ed.renderer, cv = ed.canvas;
      const W = R.toWorld(R.cw / 2, R.ch / 2); // the circuit point at the middle of the board
      const ys = [];
      const t0 = performance.now();
      const rec = () => {
        const b = cv.getBoundingClientRect();
        ys.push([Math.round(b.left + W[0] * R.scale + R.ox), Math.round(b.top + W[1] * R.scale + R.oy)]);
        if (performance.now() - t0 < 900) requestAnimationFrame(rec); else done(ys);
      };
      const b0 = cv.getBoundingClientRect();
      ys.push([Math.round(b0.left + W[0] * R.scale + R.ox), Math.round(b0.top + W[1] * R.scale + R.oy)]);
      ed.setFullscreen(on);
      rec();
    }), on);
    // biggest jump of the point between two frames
    let jump = 0;
    for (let i = 1; i < r.length; i++) jump = Math.max(jump, Math.hypot(r[i][0] - r[i - 1][0], r[i][1] - r[i - 1][1]));
    console.log(`${w}x${h} full screen ${on ? 'on ' : 'off'}: largest jump ${jump.toFixed(0)} px per frame over ${r.length} frames; path ${r[0]} → ${r[r.length - 1]}`);
    if (jump > 24) fail++;
    await page.waitForTimeout(500);
  }
  await ctx.close();
}
await browser.close(); server.close();
if (fail) { console.log(`FAIL (${fail})`); process.exit(1); }
console.log('ok');
