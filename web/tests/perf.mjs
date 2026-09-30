// Frame-rate check under CPU throttling (approximates a mid-range phone).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const out = process.argv[2] || 'shots';
const root = path.resolve('dist');
const server = http.createServer((req, res) => {
  const f = path.join(root, req.url === '/' ? 'index.html' : req.url.slice(1));
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html' }[path.extname(f)] || 'image/svg+xml' });
  fs.createReadStream(f).pipe(res);
}).listen(0);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
await ctx.addInitScript(() => { window.RaptiAndroid = { appVersion: () => 'Android test', vibrate() {}, keepScreenOn() {}, openUrl() {}, shareText() {}, saveFile() {}, openFile() {} }; localStorage.setItem('raptickt.flags.v1', JSON.stringify({ editorTips: true })); });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(`http://127.0.0.1:${server.address().port}/`);
await page.waitForTimeout(2200);
console.log('android class:', await page.evaluate(() => document.documentElement.classList.contains('android')));
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 6 });
for (const id of ['lrc', 'timer555', 'ceamp', 'counter']) {
  await page.evaluate((id) => { app.goHome(); app.openExample(id); }, id);
  await page.waitForTimeout(1500);
  await page.evaluate(() => { const ed = app.editor; if (!ed._wrapped) { const L = ed.loop; ed.jsMs = 0; ed.loop = function (ts) { const t = performance.now(); L.call(ed, ts); ed.jsMs = 0.9 * ed.jsMs + 0.1 * (performance.now() - t); }; ed._wrapped = 1; } });
  await page.waitForTimeout(4000);
  const r = await page.evaluate(() => new Promise((res) => {
    const ts = []; let n = 0;
    const f = (t) => { ts.push(t); if (++n < 120) requestAnimationFrame(f); else res(ts); };
    requestAnimationFrame(f);
  }).then((ts) => { const d = ts.slice(1).map((t, i) => t - ts[i]); d.sort((a, b) => a - b); return { avg: (ts.at(-1) - ts[0]) / (ts.length - 1), p95: d[Math.floor(d.length * 0.95)], draw: app.editor.drawMs, js: app.editor.jsMs }; }));
  console.log(id.padEnd(9), `avg ${r.avg.toFixed(1)} ms/frame  p95 ${r.p95.toFixed(1)} ms  draw ${r.draw.toFixed(1)} ms  js ${r.js.toFixed(1)} ms`);
}
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
await page.evaluate(() => { app.goHome(); app.openExample('lrc'); });
await page.waitForTimeout(1500);
await page.evaluate(() => app.editor.select(app.editor.doc.elements.find((e) => e.name === 'L1')));
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, '40-quickbar.png') });
await page.evaluate(() => { app.editor.select(null); app.editor.palette.open(); });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(out, '41-palette.png') });
await page.evaluate(() => { app.editor.palette.close(); app.editor.select(app.editor.doc.elements.find((e) => e.name === 'R1')); app.editor.inspector.openSheet(); });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(out, '42-sheet.png') });
await browser.close(); server.close();
